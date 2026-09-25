import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmailAccount, EmailAccountDocument } from '../../database/schemas/email-account.schema';
import { EmailConversation, EmailConversationDocument } from '../../database/schemas/email-conversation.schema';
import { EmailMessage, EmailMessageDocument } from '../../database/schemas/email-message.schema';
import { Contact, ContactDocument } from '../../database/schemas/contact.schema';
import { CryptoService } from '../../common/crypto/crypto.service';
import { SmtpTransportFactory } from './adapters/smtp-transport.factory';
import { ImapSyncService } from './adapters/imap-sync.service';
import { CreateEmailAccountDto, UpdateEmailAccountDto, SendEmailDto } from './dto/create-email-account.dto';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectModel(EmailAccount.name)
    private readonly accountModel: Model<EmailAccountDocument>,
    @InjectModel(EmailConversation.name)
    private readonly conversationModel: Model<EmailConversationDocument>,
    @InjectModel(EmailMessage.name)
    private readonly messageModel: Model<EmailMessageDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    private readonly cryptoService: CryptoService,
    private readonly smtpFactory: SmtpTransportFactory,
    private readonly imapSyncService: ImapSyncService,
  ) {}

  async onModuleInit() {
    if (this.accountModel?.db?.readyState !== 1) {
      this.accountModel?.db?.once('connected', () => {
        this.bootstrapEmailAccounts().catch((err) => {
          this.logger.warn(`Error during deferred email bootstrap: ${err.message}`);
        });
      });
      return;
    }
    await this.bootstrapEmailAccounts();
  }

  private async bootstrapEmailAccounts() {
    try {
      const zohoEmail = process.env.ZOHO_EMAIL?.trim().toLowerCase();
      const zohoPassword = process.env.ZOHO_SMTP_PASSWORD?.trim();
      const zohoHost = process.env.ZOHO_SMTP_HOST?.trim() || (zohoEmail?.endsWith('.in') ? 'smtp.zoho.in' : 'smtp.zoho.com');
      const zohoPort = parseInt(process.env.ZOHO_SMTP_PORT || '465', 10);
      const zohoSecure = process.env.ZOHO_SMTP_SECURE !== 'false';
      const zohoImapHost = process.env.ZOHO_IMAP_HOST?.trim() || (zohoEmail?.endsWith('.in') ? 'imap.zoho.in' : 'imap.zoho.com');
      const zohoImapPort = parseInt(process.env.ZOHO_IMAP_PORT || '993', 10);
      const zohoName = process.env.ZOHO_ACCOUNT_NAME?.trim() || 'Imprenta';
      const zohoSender = process.env.ZOHO_SENDER_NAME?.trim() || 'Imprenta';

      if (zohoEmail) {
        let account = await this.accountModel.findOne({ emailAddress: zohoEmail }).select('+encryptedPassword');

        if (!account && zohoPassword) {
          this.logger.log(`[Auto-Bootstrap] Bootstrapping Zoho Mail account for ${zohoEmail} from environment variables`);
          const encryptedPassword = this.cryptoService.encrypt(zohoPassword);
          account = new this.accountModel({
            name: zohoName,
            emailAddress: zohoEmail,
            provider: 'zoho',
            senderName: zohoSender,
            encryptedPassword,
            smtpHost: zohoHost,
            smtpPort: zohoPort,
            smtpSecure: zohoSecure,
            imapHost: zohoImapHost,
            imapPort: zohoImapPort,
            imapSecure: true,
            status: 'active',
          });
          await account.save();
          this.testConnection(String(account._id)).catch(() => {});
        } else if (account && zohoPassword) {
          // Sync configuration and password if updated in env
          account.encryptedPassword = this.cryptoService.encrypt(zohoPassword);
          account.smtpHost = zohoHost;
          account.smtpPort = zohoPort;
          account.smtpSecure = zohoSecure;
          account.imapHost = zohoImapHost;
          account.imapPort = zohoImapPort;
          account.name = zohoName;
          account.senderName = zohoSender;
          await account.save();
          this.logger.log(`[Auto-Bootstrap] Synchronized Zoho Mail credentials for ${zohoEmail}`);
        }
      }

      // Gmail Bootstrap
      const gmailEmail = process.env.GMAIL_EMAIL?.trim().toLowerCase();
      const gmailPassword = (process.env.GMAIL_SMTP_PASSWORD || process.env.GMAIL_IMAP_PASSWORD)?.trim();
      const gmailHost = process.env.GMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com';
      const gmailPort = parseInt(process.env.GMAIL_SMTP_PORT || '587', 10);
      const gmailSecure = process.env.GMAIL_SMTP_SECURE === 'true';
      const gmailImapHost = process.env.GMAIL_IMAP_HOST?.trim() || 'imap.gmail.com';
      const gmailImapPort = parseInt(process.env.GMAIL_IMAP_PORT || '993', 10);
      const gmailName = process.env.GMAIL_ACCOUNT_NAME?.trim() || 'BDE';
      const gmailSender = process.env.GMAIL_SENDER_NAME?.trim() || 'BDE';

      if (gmailEmail) {
        let gmailAcc = await this.accountModel.findOne({ emailAddress: gmailEmail }).select('+encryptedPassword');

        if (!gmailAcc && gmailPassword) {
          this.logger.log(`[Auto-Bootstrap] Bootstrapping Gmail account for ${gmailEmail} from environment variables`);
          const encryptedPassword = this.cryptoService.encrypt(gmailPassword);
          gmailAcc = new this.accountModel({
            name: gmailName,
            emailAddress: gmailEmail,
            provider: 'gmail',
            senderName: gmailSender,
            encryptedPassword,
            smtpHost: gmailHost,
            smtpPort: gmailPort,
            smtpSecure: gmailSecure,
            imapHost: gmailImapHost,
            imapPort: gmailImapPort,
            imapSecure: true,
            status: 'active',
          });
          await gmailAcc.save();
          this.testConnection(String(gmailAcc._id)).catch(() => {});
        } else if (gmailAcc && gmailPassword) {
          gmailAcc.encryptedPassword = this.cryptoService.encrypt(gmailPassword);
          gmailAcc.smtpHost = gmailHost;
          gmailAcc.smtpPort = gmailPort;
          gmailAcc.smtpSecure = gmailSecure;
          gmailAcc.imapHost = gmailImapHost;
          gmailAcc.imapPort = gmailImapPort;
          gmailAcc.name = gmailName;
          gmailAcc.senderName = gmailSender;
          await gmailAcc.save();
          this.logger.log(`[Auto-Bootstrap] Synchronized Gmail credentials for ${gmailEmail}`);
          this.testConnection(String(gmailAcc._id)).catch(() => {});
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error initializing email bootstrap: ${err.message}`);
    }
  }

  /**
   * Applies default SMTP & IMAP host/port for known providers
   */
  private applyProviderDefaults(dto: CreateEmailAccountDto) {
    if (dto.provider === 'gmail') {
      dto.smtpHost = dto.smtpHost || 'smtp.gmail.com';
      dto.smtpPort = dto.smtpPort || 587;
      dto.imapHost = dto.imapHost || 'imap.gmail.com';
      dto.imapPort = dto.imapPort || 993;
    } else if (dto.provider === 'outlook') {
      dto.smtpHost = dto.smtpHost || 'smtp.office365.com';
      dto.smtpPort = dto.smtpPort || 587;
      dto.imapHost = dto.imapHost || 'outlook.office365.com';
      dto.imapPort = dto.imapPort || 993;
    } else if (dto.provider === 'zoho') {
      const isIndiaDomain = dto.emailAddress?.toLowerCase().endsWith('.in');
      dto.smtpHost = dto.smtpHost || (isIndiaDomain ? 'smtp.zoho.in' : 'smtp.zoho.com');
      dto.smtpPort = dto.smtpPort || 465;
      dto.smtpSecure = dto.smtpSecure !== undefined ? dto.smtpSecure : true;
      dto.imapHost = dto.imapHost || (isIndiaDomain ? 'imap.zoho.in' : 'imap.zoho.com');
      dto.imapPort = dto.imapPort || 993;
    }
  }

  async findAll(): Promise<EmailAccount[]> {
    return this.accountModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string, includeSecret = false): Promise<EmailAccountDocument> {
    const query = this.accountModel.findById(id);
    if (includeSecret) {
      query.select('+encryptedPassword');
    }
    const account = await query.exec();
    if (!account) {
      throw new NotFoundException(`Email account #${id} not found`);
    }
    return account;
  }

  async create(dto: CreateEmailAccountDto): Promise<EmailAccount> {
    this.applyProviderDefaults(dto);

    const existing = await this.accountModel.findOne({ emailAddress: dto.emailAddress.toLowerCase().trim() });
    if (existing) {
      throw new BadRequestException(`Email account for '${dto.emailAddress}' already exists`);
    }

    const encryptedPassword = this.cryptoService.encrypt(dto.passwordOrToken);

    const account = new this.accountModel({
      name: dto.name,
      emailAddress: dto.emailAddress.toLowerCase().trim(),
      provider: dto.provider,
      senderName: dto.senderName,
      encryptedPassword,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpSecure: dto.smtpSecure || false,
      imapHost: dto.imapHost,
      imapPort: dto.imapPort || 993,
      imapSecure: dto.imapSecure !== false,
      hourlyLimit: dto.hourlyLimit || 50,
      dailyLimit: dto.dailyLimit || 500,
      status: 'active',
    });

    const saved = await account.save();

    // Verify SMTP connection in background
    this.testConnection(String(saved._id)).catch((err) =>
      this.logger.warn(`Initial SMTP verify warning: ${err.message}`),
    );

    return saved;
  }

  async update(id: string, dto: UpdateEmailAccountDto): Promise<EmailAccount> {
    const account = await this.findById(id, true);

    if (dto.passwordOrToken) {
      account.encryptedPassword = this.cryptoService.encrypt(dto.passwordOrToken);
    }
    if (dto.name !== undefined) account.name = dto.name;
    if (dto.senderName !== undefined) account.senderName = dto.senderName;
    if (dto.smtpHost !== undefined) account.smtpHost = dto.smtpHost;
    if (dto.smtpPort !== undefined) account.smtpPort = dto.smtpPort;
    if (dto.smtpSecure !== undefined) account.smtpSecure = dto.smtpSecure;
    if (dto.imapHost !== undefined) account.imapHost = dto.imapHost;
    if (dto.imapPort !== undefined) account.imapPort = dto.imapPort;
    if (dto.imapSecure !== undefined) account.imapSecure = dto.imapSecure;
    if (dto.status !== undefined) account.status = dto.status;
    if (dto.hourlyLimit !== undefined) account.hourlyLimit = dto.hourlyLimit;
    if (dto.dailyLimit !== undefined) account.dailyLimit = dto.dailyLimit;

    return account.save();
  }

  async delete(id: string): Promise<void> {
    await this.accountModel.findByIdAndDelete(id).exec();
  }

  async testConnection(id: string): Promise<{
    success: boolean;
    status: string;
    smtpStatus: string;
    imapStatus: string;
    message: string;
    smtpSuccess: boolean;
    imapSuccess?: boolean;
    imapError?: string;
  }> {
    const account = await this.findById(id, true);
    const password = this.cryptoService.decrypt(account.encryptedPassword);

    this.logger.log(`[Diagnostic] Testing connection for Email Account id=${id}, email=${account.emailAddress}, provider=${account.provider}`);

    // 1. Verify SMTP
    const smtpResult = await this.smtpFactory.verifyConnection({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      user: account.emailAddress,
      pass: password,
    });

    let imapResult: {
      success: boolean;
      category?: 'connected' | 'disabled_by_provider' | 'invalid_credentials' | 'timeout' | 'invalid_config' | 'sync_failed';
      error?: string;
      mailboxCount?: number;
    } | null = null;

    // 2. Verify IMAP if configured
    if (account.imapHost) {
      imapResult = await this.imapSyncService.verifyImapConnection({
        host: account.imapHost,
        port: account.imapPort || 993,
        secure: account.imapSecure !== false,
        user: account.emailAddress,
        pass: password,
      });
    }

    const smtpOk = smtpResult.success;
    account.smtpStatus = smtpOk ? 'connected' : (smtpResult.category || 'invalid_credentials');
    account.smtpErrorMessage = smtpOk ? '' : smtpResult.message;

    if (imapResult) {
      account.imapStatus = imapResult.success ? 'connected' : (imapResult.category || 'sync_failed');
      account.imapErrorMessage = imapResult.success ? '' : (imapResult.error || '');
    } else {
      account.imapStatus = 'not_configured';
      account.imapErrorMessage = '';
    }

    if (smtpOk) {
      account.status = 'active';
      account.errorMessage = account.imapErrorMessage ? `IMAP: ${account.imapErrorMessage}` : '';
    } else {
      account.status = 'invalid_credentials';
      account.errorMessage = `SMTP: ${smtpResult.message}`;
    }
    await account.save();

    let summaryMsg = smtpOk
      ? `Connected. SMTP verified successfully on ${account.smtpHost}:${account.smtpPort}.`
      : `SMTP Connection failed: ${smtpResult.message}`;

    if (imapResult) {
      summaryMsg += imapResult.success
        ? ` IMAP active (${imapResult.mailboxCount ?? 0} messages).`
        : ` (IMAP: ${account.imapErrorMessage})`;
    }

    this.logger.log(`[Diagnostic] Email Account id=${id} test result: smtpStatus=${account.smtpStatus}, imapStatus=${account.imapStatus}`);

    return {
      success: smtpOk,
      status: smtpOk ? 'Connected' : (smtpResult.category || 'Authentication failed'),
      smtpStatus: account.smtpStatus,
      imapStatus: account.imapStatus,
      message: summaryMsg,
      smtpSuccess: smtpOk,
      imapSuccess: imapResult ? imapResult.success : undefined,
      imapError: account.imapErrorMessage || undefined,
    };
  }

  /**
   * Checks whether account is eligible to send (respects status and limits)
   */
  isAccountEligible(account: EmailAccountDocument): { eligible: boolean; reason?: string } {
    if (account.status !== 'active') {
      return { eligible: false, reason: `Account status is '${account.status}'` };
    }

    const now = new Date();
    // Check if daily counter needs reset (if last sent is previous calendar day)
    if (account.lastSentAt) {
      const lastSent = new Date(account.lastSentAt);
      const isSameDay = lastSent.getUTCFullYear() === now.getUTCFullYear() &&
        lastSent.getUTCMonth() === now.getUTCMonth() &&
        lastSent.getUTCDate() === now.getUTCDate();

      if (!isSameDay) {
        account.sentTodayCount = 0;
      }

      // Check if hourly counter needs reset (if older than 1 hour)
      const hoursDiff = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
      if (hoursDiff >= 1) {
        account.sentThisHourCount = 0;
      }
    }

    if (account.sentTodayCount >= account.dailyLimit) {
      return { eligible: false, reason: `Daily sending limit (${account.dailyLimit}) reached` };
    }

    if (account.sentThisHourCount >= account.hourlyLimit) {
      return { eligible: false, reason: `Hourly sending limit (${account.hourlyLimit}) reached` };
    }

    return { eligible: true };
  }

  /**
   * Sends an outbound email using account SMTP credentials
   */
  async sendEmail(dto: SendEmailDto): Promise<EmailMessage> {
    const account = await this.findById(dto.accountId, true);
    const eligibility = this.isAccountEligible(account);
    if (!eligibility.eligible) {
      throw new BadRequestException(`Cannot send email from ${account.emailAddress}: ${eligibility.reason}`);
    }

    const password = this.cryptoService.decrypt(account.encryptedPassword);
    const transporter = this.smtpFactory.createTransporter({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      user: account.emailAddress,
      pass: password,
    });

    const fromAddress = `"${account.senderName}" <${account.emailAddress}>`;

    let providerMessageId = '';
    let status = 'sent';
    let errorMessage = '';

    try {
      const mailOptions: any = {
        from: fromAddress,
        to: dto.toEmail,
        subject: dto.subject,
        html: dto.bodyHtml,
        text: dto.bodyText || dto.bodyHtml.replace(/<[^>]*>?/gm, ''),
      };

      if (dto.cc && dto.cc.length > 0) {
        mailOptions.cc = dto.cc;
      }
      if (dto.bcc && dto.bcc.length > 0) {
        mailOptions.bcc = dto.bcc;
      }
      if (dto.attachments && dto.attachments.length > 0) {
        mailOptions.attachments = dto.attachments.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          content: att.content ? Buffer.from(att.content, 'base64') : undefined,
          path: att.url || undefined,
        }));
      }

      const info = await transporter.sendMail(mailOptions);

      providerMessageId = info.messageId || `msg_${Date.now()}`;

      // Update account sent counters
      account.sentTodayCount += 1;
      account.sentThisHourCount += 1;
      account.lastSentAt = new Date();
      await account.save();
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${dto.toEmail}: ${err.message}`);
      status = 'failed';
      errorMessage = err.message;
    }

    const hasAttachments = Boolean(dto.attachments && dto.attachments.length > 0);

    // Find or create conversation
    let conversation = await this.conversationModel.findOne({
      accountId: account._id,
      customerEmail: dto.toEmail.toLowerCase().trim(),
    });

    if (!conversation) {
      const contact = dto.contactId
        ? await this.contactModel.findById(dto.contactId)
        : await this.contactModel.findOne({ email: dto.toEmail.toLowerCase().trim() });

      conversation = new this.conversationModel({
        accountId: account._id,
        contactId: contact ? contact._id : undefined,
        customerEmail: dto.toEmail.toLowerCase().trim(),
        customerName: contact ? contact.fullName : dto.toEmail,
        subject: dto.subject,
        snippet: dto.subject,
        unreadCount: 0,
        folder: 'sent',
        hasAttachments,
        messageCount: 1,
        lastMessageAt: new Date(),
      });
      await conversation.save();
    } else {
      conversation.subject = dto.subject;
      conversation.snippet = dto.subject;
      conversation.messageCount = (conversation.messageCount || 1) + 1;
      if (hasAttachments) conversation.hasAttachments = true;
      conversation.lastMessageAt = new Date();
      await conversation.save();
    }

    const emailMsg = new this.messageModel({
      conversationId: conversation._id,
      accountId: account._id,
      contactId: conversation.contactId,
      direction: 'outbound',
      from: account.emailAddress,
      to: dto.toEmail,
      cc: dto.cc || [],
      bcc: dto.bcc || [],
      attachments: (dto.attachments || []).map((att) => ({
        filename: att.filename,
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        url: att.url || '',
      })),
      subject: dto.subject,
      bodyHtml: dto.bodyHtml,
      bodyText: dto.bodyText,
      folder: 'sent',
      status,
      providerMessageId,
      errorMessage,
      date: new Date(),
    });

    return emailMsg.save();
  }

  /**
   * Syncs inbound emails from IMAP
   */
  async syncInbox(accountId: string): Promise<{ success: boolean; syncedCount: number; status: string; message: string }> {
    const account = await this.findById(accountId, true);
    if (!account.imapHost) {
      this.logger.warn(`[Diagnostic] IMAP host not configured for account ${accountId} (${account.emailAddress})`);
      return { success: false, syncedCount: 0, status: 'not_configured', message: 'IMAP host not configured for this account' };
    }

    this.logger.log(`[Diagnostic] Starting IMAP sync for Account id=${accountId}, email=${account.emailAddress}`);

    const password = this.cryptoService.decrypt(account.encryptedPassword);
    let inboundItems: any[] = [];

    try {
      inboundItems = await this.imapSyncService.fetchRecentEmails({
        host: account.imapHost,
        port: account.imapPort || 993,
        secure: account.imapSecure !== false,
        user: account.emailAddress,
        pass: password,
      });

      account.imapStatus = 'connected';
      account.imapErrorMessage = '';
      await account.save();
    } catch (err: any) {
      const rawMsg = (err.message || '').toLowerCase();
      let safeCategory = 'sync_failed';
      let safeMsg = 'IMAP synchronization failed';

      if (
        rawMsg.includes('disabled') ||
        rawMsg.includes('not enabled') ||
        rawMsg.includes('yet to enable imap') ||
        rawMsg.includes('contact your administrator')
      ) {
        safeCategory = 'disabled_by_provider';
        safeMsg = 'IMAP is disabled for this Zoho account. Enable IMAP in Zoho Mail settings or contact your administrator.';
      } else if (rawMsg.includes('authentication') || rawMsg.includes('login') || rawMsg.includes('credential') || rawMsg.includes('auth')) {
        safeCategory = 'invalid_credentials';
        safeMsg = 'Authentication failed: Invalid username or Zoho App Password for IMAP';
      } else if (rawMsg.includes('timeout') || rawMsg.includes('timed out')) {
        safeCategory = 'timeout';
        safeMsg = `Connection timeout connecting to IMAP ${account.imapHost}:${account.imapPort}`;
      } else {
        safeCategory = 'sync_failed';
        safeMsg = `IMAP synchronization error: ${err.message || 'UNKNOWN_ERROR'}`;
      }

      account.imapStatus = safeCategory;
      account.imapErrorMessage = safeMsg;
      await account.save();

      this.logger.warn(`[Diagnostic] IMAP sync failed for Account id=${accountId} [${safeCategory}]: ${safeMsg}`);
      return {
        success: false,
        syncedCount: 0,
        status: safeCategory,
        message: safeMsg,
      };
    }

    let newCount = 0;

    for (const item of inboundItems) {
      // Check if message already exists by providerMessageId
      const existing = await this.messageModel.findOne({
        accountId: account._id,
        providerMessageId: item.messageId,
      });

      if (existing) continue;

      // Find or create conversation
      let conversation = await this.conversationModel.findOne({
        accountId: account._id,
        customerEmail: item.from.toLowerCase().trim(),
      });

      const snippet = item.bodyText.slice(0, 150).replace(/\s+/g, ' ').trim() || item.subject;

      if (!conversation) {
        const contact = await this.contactModel.findOne({ email: item.from.toLowerCase().trim() });
        conversation = new this.conversationModel({
          accountId: account._id,
          contactId: contact ? contact._id : undefined,
          customerEmail: item.from.toLowerCase().trim(),
          customerName: item.fromName,
          subject: item.subject,
          snippet,
          unreadCount: 1,
          lastMessageAt: item.date,
        });
      } else {
        conversation.subject = item.subject;
        conversation.snippet = snippet;
        conversation.unreadCount += 1;
        if (new Date(item.date) > new Date(conversation.lastMessageAt || 0)) {
          conversation.lastMessageAt = item.date;
        }
      }
      await conversation.save();

      try {
        const newMsg = new this.messageModel({
          conversationId: conversation._id,
          accountId: account._id,
          contactId: conversation.contactId,
          direction: 'inbound',
          from: item.from,
          to: item.to,
          subject: item.subject,
          bodyHtml: item.bodyHtml,
          bodyText: item.bodyText,
          status: 'delivered',
          providerMessageId: item.messageId,
          date: item.date,
        });
        await newMsg.save();
        newCount++;
      } catch (saveErr: any) {
        // Handle duplicate key race conditions gracefully
        if (saveErr.code === 11000) {
          this.logger.debug(`Skipped duplicate email insertion for ${item.messageId}`);
        } else {
          throw saveErr;
        }
      }
    }

    account.lastSyncAt = new Date();
    await account.save();

    this.logger.log(`[Diagnostic] IMAP sync complete for Account id=${accountId}. Processed ${inboundItems.length} fetched, inserted ${newCount} new record(s).`);

    return {
      success: true,
      syncedCount: newCount,
      status: 'connected',
      message: `Successfully synchronized ${newCount} new email(s)`,
    };
  }

}
