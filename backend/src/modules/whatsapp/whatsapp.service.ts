import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WhatsAppConnection, WhatsAppConnectionDocument } from '../../database/schemas/whatsapp-connection.schema';
import { WhatsAppTemplate, WhatsAppTemplateDocument } from '../../database/schemas/whatsapp-template.schema';
import { WhatsAppConversation, WhatsAppConversationDocument } from '../../database/schemas/whatsapp-conversation.schema';
import { WhatsAppMessage, WhatsAppMessageDocument } from '../../database/schemas/whatsapp-message.schema';
import { Contact, ContactDocument } from '../../database/schemas/contact.schema';
import { CryptoService } from '../../common/crypto/crypto.service';
import { OfficialWhatsAppAdapter } from './adapters/official/official-whatsapp.adapter';
import { RegularWhatsAppAdapter, NormalizedWhatsAppMessage } from './adapters/regular/regular-whatsapp.adapter';
import { CreateWhatsAppConnectionDto, SendWhatsAppMessageDto } from './dto/create-connection.dto';
import { InMemoryLiveChatStore } from './stores/in-memory-live-chat.store';
import { canonicalizePhoneNumber } from './utils/whatsapp-phone.util';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly processedWebhookEvents: Set<string> = new Set(); // In-memory idempotency cache

  constructor(
    @InjectModel(WhatsAppConnection.name)
    private readonly connectionModel: Model<WhatsAppConnectionDocument>,
    @InjectModel(WhatsAppTemplate.name)
    private readonly templateModel: Model<WhatsAppTemplateDocument>,
    @InjectModel(WhatsAppConversation.name)
    private readonly conversationModel: Model<WhatsAppConversationDocument>,
    @InjectModel(WhatsAppMessage.name)
    private readonly messageModel: Model<WhatsAppMessageDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    private readonly cryptoService: CryptoService,
    private readonly officialAdapter: OfficialWhatsAppAdapter,
    private readonly regularAdapter: RegularWhatsAppAdapter,
    private readonly inMemoryChatStore: InMemoryLiveChatStore,
  ) {}

  async onModuleInit() {
    try {
      const regularConnections = await this.connectionModel.find({
        providerType: 'regular_qr',
      }).exec();

      for (const conn of regularConnections) {
        const connId = String(conn._id);
        const hasSession = this.regularAdapter.hasSavedSession(connId);
        if (hasSession && (conn.status === 'connected' || conn.status === 'qr_ready')) {
          this.logger.log(`[Auto-Reconnect] Restoring Baileys WhatsApp session for connection #${connId} (${conn.name})`);
          this.initiateRegularQrSession(connId, false).catch((err) => {
            this.logger.warn(`Failed to auto-restore Baileys session for #${connId}: ${err.message}`);
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error during WhatsAppService onModuleInit: ${err.message}`);
    }
  }

  async findAllConnections(): Promise<WhatsAppConnection[]> {
    return this.connectionModel.find().sort({ createdAt: -1 }).exec();
  }

  async findConnectionById(id: string, includeSecrets = false): Promise<WhatsAppConnectionDocument> {
    const query = this.connectionModel.findById(id);
    if (includeSecrets) {
      query.select('+encryptedAccessToken +encryptedAppSecret');
    }
    const connection = await query.exec();
    if (!connection) {
      throw new NotFoundException(`WhatsApp connection #${id} not found`);
    }
    return connection;
  }

  async createConnection(dto: CreateWhatsAppConnectionDto): Promise<WhatsAppConnection> {
    let encryptedAccessToken = '';
    let encryptedAppSecret = '';

    if (dto.providerType === 'official_meta') {
      if (!dto.wabaId || !dto.phoneId || !dto.accessToken) {
        throw new BadRequestException('Meta WABA ID, Phone Number ID, and Access Token are required for official connections');
      }
      encryptedAccessToken = this.cryptoService.encrypt(dto.accessToken);
      if (dto.appSecret) {
        encryptedAppSecret = this.cryptoService.encrypt(dto.appSecret);
      }
    }

    const connection = new this.connectionModel({
      name: dto.name,
      providerType: dto.providerType,
      status: dto.providerType === 'official_meta' ? 'connecting' : 'disconnected',
      phoneNumber: dto.phoneNumber || '',
      wabaId: dto.wabaId,
      phoneId: dto.phoneId,
      apiVersion: dto.apiVersion || 'v20.0',
      encryptedAccessToken,
      encryptedAppSecret,
      webhookVerifyToken: dto.webhookVerifyToken || 'marketing_auto_webhook_verify',
    });

    const saved = await connection.save();

    // If official, test connection immediately
    if (dto.providerType === 'official_meta') {
      await this.testConnection(String(saved._id));
    } else {
      // If regular, initialize Baileys QR code session with DB callback and message listener
      const session = await this.initiateRegularQrSession(String(saved._id), true);
      saved.status = session.status;
      saved.qrCodeData = session.qrCodeDataUrl || '';
      await saved.save();
    }

    return saved;
  }

  /**
   * Helper to initiate Baileys session and subscribe to live socket updates and incoming messages
   */
  private async initiateRegularQrSession(connectionId: string, waitForQr = true) {
    return this.regularAdapter.initializeSession(
      connectionId,
      async (updatedSession) => {
        try {
          const updateData: any = {
            status: updatedSession.status,
            errorMessage: updatedSession.errorMessage || '',
          };

          if (updatedSession.status === 'qr_ready' && updatedSession.qrCodeDataUrl) {
            updateData.qrCodeData = updatedSession.qrCodeDataUrl;
          } else if (updatedSession.status === 'connected') {
            updateData.phoneNumber = updatedSession.phoneNumber;
            updateData.lastSeen = updatedSession.connectedAt || new Date();
            updateData.qrCodeData = '';
          } else if (updatedSession.status === 'disconnected') {
            updateData.qrCodeData = '';
          }

          await this.connectionModel.findByIdAndUpdate(connectionId, updateData);
        } catch (err: any) {
          this.logger.error(`Failed to persist connection ${connectionId} state in DB: ${err.message}`);
        }
      },
      async (normalizedMsg) => {
        await this.handleInboundRegularMessage(normalizedMsg);
      },
      async (connId, providerMsgId, status) => {
        await this.handleMessageStatusUpdate(connId, providerMsgId, status);
      },
      async (connId, stats) => {
        try {
          await this.connectionModel.findByIdAndUpdate(connId, {
            syncStatus: stats.isLatest ? 'completed' : 'syncing',
            lastSyncAt: new Date(),
            syncStats: {
              contactsCount: stats.contactsCount,
              chatsCount: stats.chatsCount,
              messagesCount: stats.messagesCount,
            },
          });
          this.logger.log(`[Diagnostic] WhatsApp connection #${connId} history sync updated: ${JSON.stringify(stats)}`);
        } catch (syncErr: any) {
          this.logger.warn(`Failed to update sync stats for connection #${connId}: ${syncErr.message}`);
        }
      },
      async (connId, cleanLid, verifiedPhone) => {
        this.inMemoryChatStore.recordLidMapping(connId, cleanLid, verifiedPhone);
      },
      waitForQr,
    );
  }

  /**
   * Updates message status (sent, delivered, read) from Baileys receipt events in memory
   */
  async handleMessageStatusUpdate(connectionId: string, providerMessageId: string, status: string): Promise<void> {
    try {
      this.inMemoryChatStore.updateMessageStatus(
        connectionId,
        providerMessageId,
        status as any,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to update in-memory status for message ${providerMessageId}: ${err.message}`);
    }
  }

  /**
   * Processes incoming regular WhatsApp messages to in-memory live stream (WhatsApp Web style by remoteJid)
   */
  async handleInboundRegularMessage(msg: NormalizedWhatsAppMessage): Promise<void> {
    this.logger.log(`[Diagnostic] handleInboundRegularMessage: conn=${msg.connectionId}, remoteJid=${msg.remoteJid}, sender=${msg.senderPhoneNumber}, recipient=${msg.recipientPhoneNumber}, verifiedPhone=${msg.externalParticipantPhone}, direction=${msg.direction}, msgId=${msg.providerMessageId}`);

    // Look up contact in DB for display name association if verified phone is present
    let contactName = msg.senderName;
    let contactId: string | undefined = undefined;
    if (msg.externalParticipantPhone) {
      try {
        const clean10 = msg.externalParticipantPhone.replace(/[^0-9]/g, '').slice(-10);
        const contact = clean10
          ? await this.contactModel.findOne({ phoneNumber: new RegExp(clean10) })
          : null;
        if (contact) {
          contactName = contact.fullName;
          contactId = String(contact._id);
        }
      } catch (err) {}
    }

    // Get or create conversation in memory directly using the exact provider remoteJid
    const conversation = this.inMemoryChatStore.getOrCreateConversation(
      msg.connectionId,
      msg.remoteJid,
      msg.externalParticipantPhone,
      contactName || msg.senderName,
      contactId,
    );

    // Append to in-memory live chat store (0 MongoDB writes)
    this.inMemoryChatStore.addMessage({
      conversationId: conversation._id,
      connectionId: msg.connectionId,
      remoteJid: conversation.remoteJid,
      contactId: conversation.contactId,
      direction: msg.direction,
      status: msg.status,
      providerMessageId: msg.providerMessageId,
      messageBody: msg.messageBody,
      messageType: msg.messageType,
      mediaUrl: msg.mediaUrl,
      mediaBase64: msg.mediaBase64,
      mimetype: msg.mimetype,
      filename: msg.filename,
      fileSize: msg.fileSize,
      thumbnail: msg.thumbnail,
      duration: msg.duration,
      latitude: msg.latitude,
      longitude: msg.longitude,
      vcard: msg.vcard,
      quotedMessage: msg.quotedMessage,
      reactionEmoji: msg.reactionEmoji,
      decryptionStatus: msg.decryptionStatus,
      senderPhoneNumber: msg.senderPhoneNumber,
      recipientPhoneNumber: msg.recipientPhoneNumber,
      externalParticipantPhone: msg.externalParticipantPhone,
      senderName: contactName || msg.senderName,
      timestamp: msg.timestamp,
    });
  }


  async testConnection(id: string): Promise<{ success: boolean; status: string; message: string; data?: any }> {
    const connection = await this.findConnectionById(id, true);

    if (connection.providerType === 'official_meta') {
      const accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);
      const res = await this.officialAdapter.testConnection({
        phoneId: connection.phoneId,
        wabaId: connection.wabaId,
        accessToken,
        apiVersion: connection.apiVersion,
      });

      if (res.success) {
        connection.status = 'connected';
        if (res.displayPhoneNumber) connection.phoneNumber = res.displayPhoneNumber;
        connection.lastSeen = new Date();
        connection.errorMessage = '';
        await connection.save();

        // Sync templates automatically in the background
        this.syncTemplates(id).catch((err) => this.logger.warn(`Template sync warning: ${err.message}`));

        return {
          success: true,
          status: 'connected',
          message: `Official Meta Connection active. Verified name: ${res.verifiedName || 'N/A'}, Phone: ${res.displayPhoneNumber}`,
          data: res,
        };
      } else {
        connection.status = 'error';
        connection.errorMessage = res.error || 'Connection failed';
        await connection.save();
        return {
          success: false,
          status: 'error',
          message: res.error || 'Connection failed',
        };
      }
    } else {
      // Regular WhatsApp QR session
      const session = await this.initiateRegularQrSession(id);
      connection.status = session.status;
      connection.qrCodeData = session.qrCodeDataUrl || '';
      if (session.phoneNumber) {
        connection.phoneNumber = session.phoneNumber;
      }
      await connection.save();

      if (session.status === 'connected') {
        return {
          success: true,
          status: 'connected',
          message: `Regular WhatsApp is active and connected (${session.phoneNumber || connection.phoneNumber || 'Authenticated'}).`,
          data: { phoneNumber: session.phoneNumber || connection.phoneNumber },
        };
      }

      return {
        success: true,
        status: session.status,
        message: 'QR code generated. Scan with your WhatsApp mobile app to connect.',
        data: { qrCode: session.qrCodeDataUrl },
      };
    }
  }

  async syncTemplates(connectionId: string): Promise<WhatsAppTemplate[]> {
    const connection = await this.findConnectionById(connectionId, true);
    if (connection.providerType !== 'official_meta') {
      return [];
    }

    const accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);
    const metaTemplates = await this.officialAdapter.fetchTemplates({
      phoneId: connection.phoneId,
      wabaId: connection.wabaId,
      accessToken,
      apiVersion: connection.apiVersion,
    });

    const savedTemplates: WhatsAppTemplate[] = [];

    for (const mt of metaTemplates) {
      const template = await this.templateModel.findOneAndUpdate(
        {
          connectionId: new Types.ObjectId(connectionId),
          name: mt.name,
          language: mt.language,
        },
        {
          connectionId: new Types.ObjectId(connectionId),
          templateId: mt.id,
          name: mt.name,
          category: mt.category,
          language: mt.language,
          status: mt.status,
          components: mt.components,
          variables: mt.variables,
        },
        { upsert: true, new: true },
      );
      savedTemplates.push(template);
    }

    return savedTemplates;
  }

  async getTemplates(connectionId?: string): Promise<WhatsAppTemplate[]> {
    const filter: any = {};
    if (connectionId) {
      filter.connectionId = new Types.ObjectId(connectionId);
    }
    return this.templateModel.find(filter).sort({ name: 1 }).exec();
  }

  async sendMessage(dto: SendWhatsAppMessageDto): Promise<any> {
    const connection = await this.findConnectionById(dto.connectionId, true);

    const destinationJid = (dto.remoteJid || dto.recipientPhoneNumber || '').trim();
    let verifiedPhone = '';
    if (!destinationJid.includes('@') || destinationJid.endsWith('@s.whatsapp.net')) {
      const { canonicalPhone } = canonicalizePhoneNumber(destinationJid);
      verifiedPhone = canonicalPhone;
    }

    const { canonicalPhone: canonSender } = canonicalizePhoneNumber(connection.phoneNumber || '');
    const connectedAccountPhone = canonSender || connection.phoneNumber || 'Connected Account';

    // Look up contact if any for display name association
    let contactName: string | undefined = undefined;
    if (dto.contactId) {
      try {
        const contact = await this.contactModel.findById(dto.contactId);
        if (contact) contactName = contact.fullName;
      } catch (err) {}
    }

    // Get or create conversation in memory directly by exact provider destination JID
    const conversation = this.inMemoryChatStore.getOrCreateConversation(
      dto.connectionId,
      destinationJid,
      verifiedPhone,
      contactName,
      dto.contactId,
    );

    let sendResult: { providerMessageId: string; status: 'sent' | 'failed'; errorMessage?: string };
    let bodySnippet = dto.customMessageBody || `[Template: ${dto.templateName}]`;

    if (connection.providerType === 'official_meta') {
      const accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);
      const config = {
        phoneId: connection.phoneId,
        wabaId: connection.wabaId,
        accessToken,
        apiVersion: connection.apiVersion,
      };

      const targetPhone = verifiedPhone || destinationJid.replace(/[^0-9]/g, '');

      if (dto.templateName) {
        sendResult = await this.officialAdapter.sendTemplateMessage(
          config,
          targetPhone,
          dto.templateName,
          dto.templateLanguage || 'en_US',
          dto.templateVariables || {},
        );
      } else {
        sendResult = await this.officialAdapter.sendTextMessage(
          config,
          targetPhone,
          dto.customMessageBody || '',
        );
      }
    } else {
      // Regular WhatsApp: Send directly to the exact destination remoteJid (WhatsApp Web architecture)
      sendResult = await this.regularAdapter.sendMessage(
        String(connection._id),
        conversation.remoteJid || destinationJid,
        {
          text: dto.customMessageBody,
          caption: dto.caption,
          messageType: dto.messageType || 'text',
          mediaBase64: dto.mediaBase64,
          mimetype: dto.mimetype,
          filename: dto.filename,
          duration: dto.duration,
          latitude: dto.latitude,
          longitude: dto.longitude,
          contactData: dto.contactData,
          quotedMessageId: dto.quotedMessageId,
          reactionEmoji: dto.reactionEmoji,
          reactionKey: dto.reactionKey,
        },
      );
    }

    // Determine message display text
    let displayBody = dto.customMessageBody || dto.caption || '';
    if (!displayBody) {
      if (dto.templateName) displayBody = `[Template: ${dto.templateName}]`;
      else if (dto.messageType && dto.messageType !== 'text') displayBody = `[${dto.messageType.toUpperCase()}] ${dto.filename || ''}`.trim();
      else if (dto.reactionEmoji) displayBody = `Reacted ${dto.reactionEmoji}`;
      else displayBody = '[Message]';
    }

    // Add ephemeral message to in-memory live stream (0 MongoDB writes)
    const ephemeralMsg = this.inMemoryChatStore.addMessage({
      conversationId: conversation._id,
      connectionId: String(connection._id),
      remoteJid: conversation.remoteJid,
      contactId: conversation.contactId,
      direction: 'outbound',
      status: sendResult.status,
      providerMessageId: sendResult.providerMessageId,
      messageBody: displayBody,
      messageType: dto.messageType || (dto.reactionEmoji ? 'reaction' : 'text'),
      mediaUrl: dto.mediaBase64 ? `data:${dto.mimetype || 'image/jpeg'};base64,${dto.mediaBase64}` : undefined,
      mediaBase64: dto.mediaBase64,
      mimetype: dto.mimetype,
      filename: dto.filename,
      fileSize: dto.fileSize,
      duration: dto.duration,
      latitude: dto.latitude,
      longitude: dto.longitude,
      vcard: dto.contactData?.vcard,
      quotedMessage: dto.quotedMessageId ? { id: dto.quotedMessageId, body: '' } : undefined,
      reactionEmoji: dto.reactionEmoji,
      senderPhoneNumber: connectedAccountPhone,
      recipientPhoneNumber: verifiedPhone || destinationJid,
      externalParticipantPhone: verifiedPhone || destinationJid,
      errorMessage: sendResult.errorMessage,
      timestamp: new Date(),
    });

    return ephemeralMsg;
  }

  /**
   * Meta Webhook challenge verification (GET)
   */
  verifyWebhook(mode: string, token: string, challenge: string, configuredToken?: string): string {
    const expected = configuredToken || process.env.META_VERIFY_TOKEN || 'marketing_auto_webhook_verify';
    if (mode === 'subscribe' && token === expected) {
      return challenge;
    }
    throw new BadRequestException('Webhook verification token mismatch');
  }

  /**
   * Meta Webhook event ingestion (POST) - Routes to in-memory live store
   */
  async processWebhookEvent(rawBody: any, signatureHeader?: string): Promise<{ success: boolean; processedEvents: number }> {
    let processedCount = 0;
    const entries = rawBody.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // 1. Process Status Updates (sent, delivered, read, failed)
        const statuses = value.statuses || [];
        for (const statusObj of statuses) {
          const wamid = statusObj.id;
          const status = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const idempotencyKey = `status_${wamid}_${status}`;

          if (this.processedWebhookEvents.has(idempotencyKey)) continue;
          this.processedWebhookEvents.add(idempotencyKey);

          this.inMemoryChatStore.updateMessageStatus('', wamid, status);
          processedCount++;
        }

        // 2. Process Inbound Messages
        const messages = value.messages || [];
        const contactsMeta = value.contacts || [];
        const metadata = value.metadata || {};
        const phoneId = metadata.phone_number_id;

        for (const msgObj of messages) {
          const wamid = msgObj.id;
          const idempotencyKey = `msg_${wamid}`;

          if (this.processedWebhookEvents.has(idempotencyKey)) continue;
          this.processedWebhookEvents.add(idempotencyKey);

          const fromPhone = msgObj.from;
          const textBody = msgObj.text?.body || `[${msgObj.type || 'media'} message]`;
          const senderName = contactsMeta.find((c: any) => c.wa_id === fromPhone)?.profile?.name || fromPhone;

          // Find connection matching phoneId
          const connection = phoneId
            ? await this.connectionModel.findOne({ phoneId })
            : await this.connectionModel.findOne({ providerType: 'official_meta', status: 'connected' });

          if (!connection) continue;

          const fromJid = `${fromPhone}@s.whatsapp.net`;
          // Get or create in-memory ephemeral conversation
          const conversation = this.inMemoryChatStore.getOrCreateConversation(
            String(connection._id),
            fromJid,
            fromPhone,
            senderName,
          );

          // Add to in-memory live chat store (0 MongoDB writes)
          this.inMemoryChatStore.addMessage({
            conversationId: conversation._id,
            connectionId: String(connection._id),
            remoteJid: fromJid,
            contactId: conversation.contactId,
            direction: 'inbound',
            status: 'delivered',
            providerMessageId: wamid,
            messageBody: textBody,
            senderPhoneNumber: fromPhone,
            senderName: senderName,
            timestamp: new Date(parseInt(msgObj.timestamp, 10) * 1000 || Date.now()),
          });

          processedCount++;
        }
      }
    }

    return { success: true, processedEvents: processedCount };
  }

  async deleteConnection(id: string): Promise<void> {
    await this.regularAdapter.disconnect(id);
    await this.connectionModel.findByIdAndDelete(id).exec();
    await this.templateModel.deleteMany({ connectionId: new Types.ObjectId(id) }).exec();
  }
}
