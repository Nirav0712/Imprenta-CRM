import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmailConversation, EmailConversationDocument } from '../../../database/schemas/email-conversation.schema';
import { EmailMessage, EmailMessageDocument } from '../../../database/schemas/email-message.schema';
import { EmailService } from '../../email/email.service';

@Injectable()
export class EmailInboxService {
  private readonly logger = new Logger(EmailInboxService.name);

  constructor(
    @InjectModel(EmailConversation.name)
    private readonly conversationModel: Model<EmailConversationDocument>,
    @InjectModel(EmailMessage.name)
    private readonly messageModel: Model<EmailMessageDocument>,
    private readonly emailService: EmailService,
  ) {}

  async getConversations(
    accountId?: string,
    folder: string = 'inbox',
    search?: string,
    page: number = 1,
    limit: number = 50,
    label?: string,
  ) {
    this.logger.log(
      `[Diagnostic] getConversations called. accountId=${accountId || 'ALL'}, folder=${folder}, search="${search || ''}", page=${page}, limit=${limit}`,
    );

    const filter: any = {};
    if (accountId && Types.ObjectId.isValid(accountId)) {
      filter.accountId = new Types.ObjectId(accountId);
    }

    // Apply Folder / Filter
    if (label) {
      filter.labels = label;
    } else if (folder === 'starred') {
      filter.isStarred = true;
    } else if (folder === 'important') {
      filter.isImportant = true;
    } else if (folder === 'snoozed') {
      filter.snoozedUntil = { $ne: null, $gt: new Date() };
    } else if (folder === 'all') {
      // no folder constraint
    } else if (['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'].includes(folder)) {
      filter.folder = folder;
    } else {
      filter.folder = 'inbox';
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { customerEmail: regex },
        { customerName: regex },
        { subject: regex },
        { snippet: regex },
      ];
    }

    const skip = (Math.max(1, page) - 1) * limit;

    const [items, total] = await Promise.all([
      this.conversationModel
        .find(filter)
        .populate('accountId', 'name emailAddress senderName provider status smtpStatus imapStatus smtpErrorMessage imapErrorMessage')
        .populate('contactId', 'fullName email company')
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.conversationModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getCounts(accountId?: string) {
    const baseFilter: any = {};
    if (accountId && Types.ObjectId.isValid(accountId)) {
      baseFilter.accountId = new Types.ObjectId(accountId);
    }

    const [inboxUnread, starred, sent, drafts, spam, trash, important, snoozed] = await Promise.all([
      this.conversationModel.countDocuments({ ...baseFilter, folder: 'inbox', unreadCount: { $gt: 0 } }).exec(),
      this.conversationModel.countDocuments({ ...baseFilter, isStarred: true }).exec(),
      this.conversationModel.countDocuments({ ...baseFilter, folder: 'sent' }).exec(),
      this.conversationModel.countDocuments({ ...baseFilter, folder: 'drafts' }).exec(),
      this.conversationModel.countDocuments({ ...baseFilter, folder: 'spam' }).exec(),
      this.conversationModel.countDocuments({ ...baseFilter, folder: 'trash' }).exec(),
      this.conversationModel.countDocuments({ ...baseFilter, isImportant: true }).exec(),
      this.conversationModel.countDocuments({ ...baseFilter, snoozedUntil: { $ne: null, $gt: new Date() } }).exec(),
    ]);

    return {
      inbox: inboxUnread,
      starred,
      sent,
      drafts,
      spam,
      trash,
      important,
      snoozed,
    };
  }

  async getMessages(conversationId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Email conversation #${conversationId} not found`);
    }

    // Mark as read on open
    if (conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
      await conversation.save();
    }

    return this.messageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ date: 1 })
      .exec();
  }

  async updateConversation(
    id: string,
    updates: {
      isRead?: boolean;
      isStarred?: boolean;
      isImportant?: boolean;
      folder?: string;
      labels?: string[];
      snoozedUntil?: Date | null;
      unreadCount?: number;
    },
  ) {
    const conversation = await this.conversationModel.findById(id);
    if (!conversation) {
      throw new NotFoundException(`Email conversation #${id} not found`);
    }

    if (updates.isRead !== undefined) {
      conversation.unreadCount = updates.isRead ? 0 : 1;
    }
    if (updates.unreadCount !== undefined) {
      conversation.unreadCount = updates.unreadCount;
    }
    if (updates.isStarred !== undefined) {
      conversation.isStarred = updates.isStarred;
    }
    if (updates.isImportant !== undefined) {
      conversation.isImportant = updates.isImportant;
    }
    if (updates.folder !== undefined) {
      conversation.folder = updates.folder;
    }
    if (updates.labels !== undefined) {
      conversation.labels = updates.labels;
    }
    if (updates.snoozedUntil !== undefined) {
      conversation.snoozedUntil = updates.snoozedUntil;
    }

    return conversation.save();
  }

  async bulkAction(
    ids: string[],
    action: string,
    payload?: { folder?: string; label?: string; isImportant?: boolean },
  ) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids array must not be empty');
    }

    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) {
      return { success: true, count: 0 };
    }

    let updateDoc: any = null;

    switch (action) {
      case 'mark_read':
        updateDoc = { $set: { unreadCount: 0 } };
        break;
      case 'mark_unread':
        updateDoc = { $set: { unreadCount: 1 } };
        break;
      case 'star':
        updateDoc = { $set: { isStarred: true } };
        break;
      case 'unstar':
        updateDoc = { $set: { isStarred: false } };
        break;
      case 'mark_important':
        updateDoc = { $set: { isImportant: payload?.isImportant !== false } };
        break;
      case 'move_folder':
        if (!payload?.folder) throw new BadRequestException('folder is required for move_folder action');
        updateDoc = { $set: { folder: payload.folder } };
        break;
      case 'add_label':
        if (!payload?.label) throw new BadRequestException('label is required for add_label action');
        updateDoc = { $addToSet: { labels: payload.label } };
        break;
      case 'remove_label':
        if (!payload?.label) throw new BadRequestException('label is required for remove_label action');
        updateDoc = { $pull: { labels: payload.label } };
        break;
      case 'delete_permanent':
        await Promise.all([
          this.conversationModel.deleteMany({ _id: { $in: objectIds } }).exec(),
          this.messageModel.deleteMany({ conversationId: { $in: objectIds } }).exec(),
        ]);
        return { success: true, count: objectIds.length, action };
      default:
        throw new BadRequestException(`Unknown bulk action: ${action}`);
    }

    const res = await this.conversationModel.updateMany({ _id: { $in: objectIds } }, updateDoc).exec();
    return { success: true, count: res.modifiedCount, action };
  }

  async deleteConversation(id: string) {
    const conversation = await this.conversationModel.findById(id);
    if (!conversation) {
      throw new NotFoundException(`Email conversation #${id} not found`);
    }

    // If not already in trash, move to trash; if already in trash, permanently delete
    if (conversation.folder !== 'trash') {
      conversation.folder = 'trash';
      await conversation.save();
      return { success: true, movedToTrash: true };
    } else {
      await Promise.all([
        this.conversationModel.findByIdAndDelete(id).exec(),
        this.messageModel.deleteMany({ conversationId: new Types.ObjectId(id) }).exec(),
      ]);
      return { success: true, deletedPermanent: true };
    }
  }

  async saveDraft(data: {
    accountId: string;
    toEmail?: string;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: any[];
    draftId?: string;
  }) {
    if (!data.accountId) throw new BadRequestException('accountId is required for draft');

    const toEmail = data.toEmail?.trim().toLowerCase() || 'draft@automarket.local';
    const subject = data.subject || '(no subject)';

    let conversation: EmailConversationDocument | null = null;
    if (data.draftId && Types.ObjectId.isValid(data.draftId)) {
      conversation = await this.conversationModel.findById(data.draftId);
    }

    if (!conversation) {
      conversation = new this.conversationModel({
        accountId: new Types.ObjectId(data.accountId),
        customerEmail: toEmail,
        customerName: toEmail,
        subject,
        snippet: subject,
        unreadCount: 0,
        folder: 'drafts',
        hasAttachments: Boolean(data.attachments?.length),
        messageCount: 1,
        lastMessageAt: new Date(),
      });
      await conversation.save();
    } else {
      conversation.customerEmail = toEmail;
      conversation.customerName = toEmail;
      conversation.subject = subject;
      conversation.snippet = subject;
      conversation.folder = 'drafts';
      conversation.hasAttachments = Boolean(data.attachments?.length);
      conversation.lastMessageAt = new Date();
      await conversation.save();
    }

    // Replace or create draft message
    await this.messageModel.deleteMany({ conversationId: conversation._id, isDraft: true }).exec();

    const draftMsg = new this.messageModel({
      conversationId: conversation._id,
      accountId: new Types.ObjectId(data.accountId),
      direction: 'outbound',
      from: 'draft',
      to: toEmail,
      cc: data.cc || [],
      bcc: data.bcc || [],
      subject,
      bodyHtml: data.bodyHtml || '',
      bodyText: data.bodyText || '',
      attachments: data.attachments || [],
      folder: 'drafts',
      isDraft: true,
      status: 'pending',
      date: new Date(),
    });
    await draftMsg.save();

    return {
      success: true,
      draftId: String(conversation._id),
      messageId: String(draftMsg._id),
      conversation,
    };
  }

  async replyMessage(
    conversationId: string,
    subject: string,
    bodyHtml: string,
    cc?: string[],
    bcc?: string[],
    attachments?: any[],
  ) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Email conversation #${conversationId} not found`);
    }

    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${conversation.subject || subject}`;

    return this.emailService.sendEmail({
      accountId: String(conversation.accountId),
      toEmail: conversation.customerEmail,
      contactId: conversation.contactId ? String(conversation.contactId) : undefined,
      subject: replySubject,
      bodyHtml,
      cc,
      bcc,
      attachments,
    });
  }
}
