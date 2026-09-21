import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WhatsAppConversation, WhatsAppConversationDocument } from '../../../database/schemas/whatsapp-conversation.schema';
import { WhatsAppMessage, WhatsAppMessageDocument } from '../../../database/schemas/whatsapp-message.schema';
import { Contact, ContactDocument } from '../../../database/schemas/contact.schema';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { InMemoryLiveChatStore } from '../../whatsapp/stores/in-memory-live-chat.store';
import { canonicalizePhoneNumber } from '../../whatsapp/utils/whatsapp-phone.util';

export interface StartConversationDto {
  connectionId: string;
  recipientPhoneNumber: string;
  customerName?: string;
  messageBody?: string;
}

export interface UpdateConversationDto {
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  unreadCount?: number;
}

export interface ReplyWhatsAppDto {
  text?: string;
  messageBody?: string;
  caption?: string;
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'location' | 'contact' | 'reaction';
  mediaBase64?: string;
  mimetype?: string;
  filename?: string;
  fileSize?: number;
  duration?: number;
  latitude?: number;
  longitude?: number;
  contactData?: { displayName: string; vcard: string };
  quotedMessageId?: string;
  reactionEmoji?: string;
  reactionKey?: { remoteJid?: string; id?: string; fromMe?: boolean };
}

@Injectable()
export class WhatsAppInboxService {
  private readonly logger = new Logger(WhatsAppInboxService.name);

  constructor(
    @InjectModel(WhatsAppConversation.name)
    private readonly conversationModel: Model<WhatsAppConversationDocument>,
    @InjectModel(WhatsAppMessage.name)
    private readonly messageModel: Model<WhatsAppMessageDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    private readonly whatsappService: WhatsAppService,
    private readonly inMemoryChatStore: InMemoryLiveChatStore,
  ) {}

  async getConversations(
    connectionId?: string,
    search?: string,
    filterType?: 'all' | 'unread' | 'pinned' | 'archived',
  ) {
    this.logger.log(
      `[Diagnostic] WhatsApp getConversations (Ephemeral Live Stream): connectionId=${connectionId || 'ALL'}, search="${search || ''}", filter=${filterType || 'all'}`,
    );

    let connectedPhoneNumber = '';
    if (connectionId && connectionId !== 'ALL') {
      try {
        const conn = await this.whatsappService.findConnectionById(connectionId, false);
        connectedPhoneNumber = conn?.phoneNumber || '';
      } catch (e) {}
    }

    // Get live in-memory conversations with host self-chat filtering
    const inMemoryList = this.inMemoryChatStore.getAllConversations(
      connectionId,
      search,
      filterType,
      connectedPhoneNumber,
    );

    this.logger.log(`[Diagnostic] WhatsApp getConversations returning ${inMemoryList.length} active chat session(s)`);
    return inMemoryList;
  }

  async getMessages(conversationId: string, limit = 50, before?: string) {
    // 1. Try direct in-memory lookup (0 MongoDB reads from message collections)
    let ephemeralMessages = this.inMemoryChatStore.getMessages(conversationId, limit, before);
    if (ephemeralMessages.length > 0) {
      return ephemeralMessages;
    }

    // 2. Fallback: resolve by remoteJid or phone number if conversationId is a database conversation header
    try {
      const dbConv = await this.conversationModel.findById(conversationId);
      if (dbConv) {
        const memConv = this.inMemoryChatStore.getConversationByKey(
          String(dbConv.connectionId),
          dbConv.remoteJid || dbConv.customerPhoneNumber,
        );
        if (memConv) {
          return this.inMemoryChatStore.getMessages(memConv._id, limit, before);
        }
      }
    } catch (err) {}

    return [];
  }

  async replyMessage(conversationId: string, replyPayload: ReplyWhatsAppDto | string) {
    const dto: ReplyWhatsAppDto =
      typeof replyPayload === 'string'
        ? { text: replyPayload, messageType: 'text' }
        : replyPayload || {};

    const textContent = (dto.text || dto.messageBody || '').trim();
    const hasContent =
      textContent ||
      dto.mediaBase64 ||
      dto.reactionEmoji ||
      (dto.latitude && dto.longitude) ||
      dto.contactData;

    if (!hasContent) {
      throw new BadRequestException('Reply cannot be empty. Please provide text or media/reaction.');
    }

    // Try in-memory conversation first
    let conv = this.inMemoryChatStore.getConversationById(conversationId);
    let connectionId = conv ? String(conv.connectionId) : '';
    let remoteJid = conv ? conv.remoteJid : '';
    let customerPhone = conv ? conv.customerPhoneNumber : '';
    let contactId = conv?.contactId ? String(conv.contactId) : undefined;

    // Fallback to database conversation header if not in memory
    if (!conv) {
      const dbConv = await this.conversationModel.findById(conversationId);
      if (dbConv) {
        connectionId = String(dbConv.connectionId);
        remoteJid = dbConv.remoteJid || '';
        customerPhone = dbConv.customerPhoneNumber;
        contactId = dbConv.contactId ? String(dbConv.contactId) : undefined;
      }
    }

    const destination = remoteJid || customerPhone;
    if (!destination || !connectionId) {
      throw new NotFoundException(`Active conversation #${conversationId} not found`);
    }

    return this.whatsappService.sendMessage({
      connectionId,
      recipientPhoneNumber: customerPhone || destination,
      remoteJid: remoteJid || (destination.includes('@') ? destination : undefined),
      contactId,
      customMessageBody: textContent,
      caption: dto.caption?.trim(),
      messageType: dto.messageType || (dto.mediaBase64 ? 'image' : 'text'),
      mediaBase64: dto.mediaBase64,
      mimetype: dto.mimetype,
      filename: dto.filename,
      fileSize: dto.fileSize,
      duration: dto.duration,
      latitude: dto.latitude,
      longitude: dto.longitude,
      contactData: dto.contactData,
      quotedMessageId: dto.quotedMessageId,
      reactionEmoji: dto.reactionEmoji,
      reactionKey: dto.reactionKey,
    });
  }

  async reactMessage(
    conversationId: string,
    emoji: string,
    messageId: string,
    fromMe = false,
  ) {
    if (!emoji || !messageId) {
      throw new BadRequestException('Emoji and message ID are required for reaction');
    }

    let conv = this.inMemoryChatStore.getConversationById(conversationId);
    let connectionId = conv ? String(conv.connectionId) : '';
    let customerPhone = conv ? conv.customerPhoneNumber : '';

    if (!conv) {
      const dbConv = await this.conversationModel.findById(conversationId);
      if (dbConv) {
        connectionId = String(dbConv.connectionId);
        customerPhone = dbConv.customerPhoneNumber;
      }
    }

    if (!customerPhone || !connectionId) {
      throw new NotFoundException(`Active conversation #${conversationId} not found`);
    }

    return this.whatsappService.sendMessage({
      connectionId,
      recipientPhoneNumber: customerPhone,
      messageType: 'reaction',
      reactionEmoji: emoji,
      reactionKey: {
        id: messageId,
        fromMe,
      },
    });
  }

  async startConversation(dto: StartConversationDto) {
    if (!dto.connectionId || !dto.recipientPhoneNumber) {
      throw new BadRequestException('Connection ID and recipient phone number are required');
    }

    const { canonicalPhone, nationalPhone } = canonicalizePhoneNumber(dto.recipientPhoneNumber);
    const cleanPhone = canonicalPhone || dto.recipientPhoneNumber.trim();

    // Look up contact by phone number
    const clean10 = nationalPhone || cleanPhone.replace(/[^0-9]/g, '').slice(-10);
    let contact = clean10
      ? await this.contactModel.findOne({ phoneNumber: new RegExp(clean10) })
      : null;

    if (!contact && dto.customerName) {
      contact = new this.contactModel({
        fullName: dto.customerName,
        phoneNumber: cleanPhone,
        status: 'active',
      });
      await contact.save();
    }

    const phoneRegex = clean10 ? new RegExp(clean10 + '$') : undefined;
    let conversation = await this.conversationModel.findOne({
      connectionId: new Types.ObjectId(dto.connectionId),
      $or: [
        { customerPhoneNumber: cleanPhone },
        ...(phoneRegex ? [{ customerPhoneNumber: phoneRegex }] : []),
      ],
    });

    if (!conversation) {
      conversation = new this.conversationModel({
        connectionId: new Types.ObjectId(dto.connectionId),
        contactId: contact ? contact._id : undefined,
        customerPhoneNumber: cleanPhone,
        customerName: contact ? contact.fullName : (dto.customerName || cleanPhone),
        lastMessageText: dto.messageBody || '',
        unreadCount: 0,
        lastActivityAt: new Date(),
      });
      await conversation.save();
    }

    let initialMessage: WhatsAppMessage | null = null;
    if (dto.messageBody && dto.messageBody.trim()) {
      initialMessage = await this.whatsappService.sendMessage({
        connectionId: dto.connectionId,
        recipientPhoneNumber: cleanPhone,
        contactId: contact ? String(contact._id) : undefined,
        customMessageBody: dto.messageBody.trim(),
      });
    }

    return {
      conversation: await this.conversationModel
        .findById(conversation._id)
        .populate('connectionId', 'name providerType status phoneNumber')
        .populate('contactId', 'fullName email company'),
      initialMessage,
    };
  }

  async updateConversation(id: string, updateDto: UpdateConversationDto) {
    const conversation = await this.conversationModel.findById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation #${id} not found`);
    }

    if (updateDto.isPinned !== undefined) conversation.isPinned = updateDto.isPinned;
    if (updateDto.isMuted !== undefined) conversation.isMuted = updateDto.isMuted;
    if (updateDto.isArchived !== undefined) conversation.isArchived = updateDto.isArchived;
    if (updateDto.unreadCount !== undefined) conversation.unreadCount = updateDto.unreadCount;

    await conversation.save();
    return conversation;
  }

  async clearMessages(conversationId: string) {
    this.inMemoryChatStore.clearMessages(conversationId);

    try {
      const conversation = await this.conversationModel.findById(conversationId);
      if (conversation) {
        this.inMemoryChatStore.clearMessagesByKey(
          String(conversation.connectionId),
          conversation.customerPhoneNumber,
        );
        conversation.lastMessageText = '';
        conversation.unreadCount = 0;
        await conversation.save();
      }
    } catch (err) {}

    return { success: true, message: 'Message history cleared from memory' };
  }

  async retryMessage(messageId: string) {
    return { success: false, message: 'Ephemeral live chat messages cannot be retried from database' };
  }
}
