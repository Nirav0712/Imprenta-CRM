import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Campaign, CampaignDocument } from '../../database/schemas/campaign.schema';
import { CampaignRecipient, CampaignRecipientDocument } from '../../database/schemas/campaign-recipient.schema';
import { EmailAccount, EmailAccountDocument } from '../../database/schemas/email-account.schema';
import { WhatsAppConnection, WhatsAppConnectionDocument } from '../../database/schemas/whatsapp-connection.schema';
import { Contact, ContactDocument } from '../../database/schemas/contact.schema';
import { SendingLog, SendingLogDocument } from '../../database/schemas/sending-log.schema';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class SendingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SendingQueueService.name);
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignRecipient.name)
    private readonly recipientModel: Model<CampaignRecipientDocument>,
    @InjectModel(EmailAccount.name)
    private readonly emailAccountModel: Model<EmailAccountDocument>,
    @InjectModel(WhatsAppConnection.name)
    private readonly waConnectionModel: Model<WhatsAppConnectionDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(SendingLog.name)
    private readonly sendingLogModel: Model<SendingLogDocument>,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.processNextBatch(), 2000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Main Queue processing tick
   */
  async processNextBatch() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const campaign = await this.campaignModel.findOne({
        status: { $in: ['queued', 'running'] },
      }).sort({ updatedAt: 1 }).exec();

      if (!campaign) {
        this.isProcessing = false;
        return;
      }

      if (campaign.status === 'queued') {
        campaign.status = 'running';
        campaign.startedAt = new Date();
        await campaign.save();
      }

      if (campaign.status === 'paused' || campaign.status === 'cancelled') {
        this.isProcessing = false;
        return;
      }

      if (campaign.channel === 'email') {
        await this.processEmailCampaignBatch(campaign);
      } else if (campaign.channel === 'whatsapp') {
        await this.processWhatsAppCampaignBatch(campaign);
      }
    } catch (err: any) {
      this.logger.error(`Error in queue worker: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes a batch of email recipients with multi-account rotation
   */
  private async processEmailCampaignBatch(campaign: CampaignDocument) {
    const policy = campaign.sendingPolicy || { perMessageDelaySec: 2, batchSize: 20, batchPauseSec: 60 };
    const batchSize = Math.min(policy.batchSize || 20, 20);

    const recipients = await this.recipientModel
      .find({ campaignId: campaign._id, status: 'pending' })
      .limit(batchSize)
      .exec();

    if (recipients.length === 0) {
      const pendingCount = await this.recipientModel.countDocuments({
        campaignId: campaign._id,
        status: { $in: ['pending', 'processing'] },
      });

      if (pendingCount === 0) {
        campaign.status = 'completed';
        campaign.completedAt = new Date();
        await campaign.save();
        this.logger.log(`Email Campaign '${campaign.name}' completed successfully`);
      }
      return;
    }

    const accountIds = (campaign.emailConfig?.accountIds || []).map((id: any) => new Types.ObjectId(id));
    const accounts = await this.emailAccountModel.find({ _id: { $in: accountIds }, status: 'active' }).exec();

    if (accounts.length === 0) {
      campaign.status = 'paused';
      campaign.errorMessage = 'No active email accounts available for this campaign';
      await campaign.save();
      return;
    }

    let accountIndex = 0;

    for (const recipient of recipients) {
      const currentCampaign = await this.campaignModel.findById(campaign._id);
      if (currentCampaign?.status !== 'running') break;

      recipient.status = 'processing';
      await recipient.save();

      let selectedAccount: EmailAccountDocument | null = null;
      for (let attempts = 0; attempts < accounts.length; attempts++) {
        const candidate = accounts[accountIndex % accounts.length];
        accountIndex++;
        const eligibility = this.emailService.isAccountEligible(candidate);
        if (eligibility.eligible) {
          selectedAccount = candidate;
          break;
        }
      }

      if (!selectedAccount) {
        this.logger.warn(`All selected email accounts exhausted their limits for campaign '${campaign.name}'`);
        campaign.status = 'paused';
        campaign.errorMessage = 'All selected email accounts have reached their hourly or daily sending limits';
        await campaign.save();
        recipient.status = 'pending';
        await recipient.save();
        break;
      }

      const contact = await this.contactModel.findById(recipient.contactId);
      const subject = this.interpolateVariables(campaign.emailConfig.subject || '', contact);
      const bodyHtml = this.interpolateVariables(campaign.emailConfig.bodyHtml || '', contact);

      try {
        const emailMsg = await this.emailService.sendEmail({
          accountId: String(selectedAccount._id),
          toEmail: recipient.recipientIdentifier,
          contactId: contact ? String(contact._id) : undefined,
          subject,
          bodyHtml,
        });

        if (emailMsg.status === 'sent') {
          recipient.status = 'sent';
          recipient.sentAt = new Date();
          recipient.assignedEmailAccountId = selectedAccount._id as any;
          recipient.providerMessageId = emailMsg.providerMessageId;
          campaign.sentCount += 1;

          await this.sendingLogModel.create({
            campaignId: campaign._id,
            contactId: contact?._id,
            channel: 'email',
            recipient: recipient.recipientIdentifier,
            status: 'success',
            providerMessageId: emailMsg.providerMessageId,
            details: { account: selectedAccount.emailAddress },
          });
        } else {
          recipient.status = 'failed';
          recipient.errorMessage = emailMsg.errorMessage;
          campaign.failedCount += 1;

          await this.sendingLogModel.create({
            campaignId: campaign._id,
            contactId: contact?._id,
            channel: 'email',
            recipient: recipient.recipientIdentifier,
            status: 'failed',
            errorMessage: emailMsg.errorMessage,
          });
        }
      } catch (sendErr: any) {
        recipient.status = 'failed';
        recipient.errorMessage = sendErr.message;
        campaign.failedCount += 1;

        await this.sendingLogModel.create({
          campaignId: campaign._id,
          contactId: contact?._id,
          channel: 'email',
          recipient: recipient.recipientIdentifier,
          status: 'failed',
          errorMessage: sendErr.message,
        });
      }

      await recipient.save();
      await campaign.save();

      if (policy.perMessageDelaySec && policy.perMessageDelaySec > 0) {
        await this.sleep(Math.min(policy.perMessageDelaySec, 10) * 1000);
      }
    }
  }

  /**
   * Processes a batch of WhatsApp recipients
   */
  private async processWhatsAppCampaignBatch(campaign: CampaignDocument) {
    const policy = campaign.sendingPolicy || { perMessageDelaySec: 2, batchSize: 20, batchPauseSec: 60 };
    const batchSize = Math.min(policy.batchSize || 20, 20);

    const recipients = await this.recipientModel
      .find({ campaignId: campaign._id, status: 'pending' })
      .limit(batchSize)
      .exec();

    if (recipients.length === 0) {
      const pendingCount = await this.recipientModel.countDocuments({
        campaignId: campaign._id,
        status: { $in: ['pending', 'processing'] },
      });

      if (pendingCount === 0) {
        campaign.status = 'completed';
        campaign.completedAt = new Date();
        await campaign.save();
        this.logger.log(`WhatsApp Campaign '${campaign.name}' completed`);
      }
      return;
    }

    const connectionId = campaign.whatsappConfig?.connectionId;
    if (!connectionId) {
      campaign.status = 'paused';
      campaign.errorMessage = 'No WhatsApp connection specified for campaign';
      await campaign.save();
      return;
    }

    for (const recipient of recipients) {
      const currentCampaign = await this.campaignModel.findById(campaign._id);
      if (currentCampaign?.status !== 'running') break;

      recipient.status = 'processing';
      await recipient.save();

      const contact = await this.contactModel.findById(recipient.contactId);

      const variableValues: Record<string, string> = {};
      const variableMapping = campaign.whatsappConfig?.variableMapping || {};
      for (const [varIndex, fieldKey] of Object.entries(variableMapping)) {
        if (contact) {
          variableValues[varIndex] = (contact as any)[fieldKey] || (contact.customFields && contact.customFields[fieldKey]) || '';
        }
      }

      try {
        const msg = await this.whatsappService.sendMessage({
          connectionId: String(connectionId),
          recipientPhoneNumber: recipient.recipientIdentifier,
          contactId: contact ? String(contact._id) : undefined,
          templateName: campaign.whatsappConfig?.templateName,
          templateVariables: variableValues,
          customMessageBody: this.interpolateVariables(campaign.whatsappConfig?.customMessageBody || '', contact),
        });

        if (msg.status !== 'failed') {
          recipient.status = 'sent';
          recipient.sentAt = new Date();
          recipient.assignedWhatsAppConnectionId = connectionId as any;
          recipient.providerMessageId = msg.providerMessageId;
          campaign.sentCount += 1;

          await this.sendingLogModel.create({
            campaignId: campaign._id,
            contactId: contact?._id,
            channel: 'whatsapp',
            recipient: recipient.recipientIdentifier,
            status: 'success',
            providerMessageId: msg.providerMessageId,
          });
        } else {
          recipient.status = 'failed';
          recipient.errorMessage = msg.errorMessage;
          campaign.failedCount += 1;

          await this.sendingLogModel.create({
            campaignId: campaign._id,
            contactId: contact?._id,
            channel: 'whatsapp',
            recipient: recipient.recipientIdentifier,
            status: 'failed',
            errorMessage: msg.errorMessage,
          });
        }
      } catch (err: any) {
        recipient.status = 'failed';
        recipient.errorMessage = err.message;
        campaign.failedCount += 1;

        await this.sendingLogModel.create({
          campaignId: campaign._id,
          contactId: contact?._id,
          channel: 'whatsapp',
          recipient: recipient.recipientIdentifier,
          status: 'failed',
          errorMessage: err.message,
        });
      }

      await recipient.save();
      await campaign.save();

      if (policy.perMessageDelaySec && policy.perMessageDelaySec > 0) {
        await this.sleep(Math.min(policy.perMessageDelaySec, 10) * 1000);
      }
    }
  }

  /**
   * Replaces placeholders like {{firstName}}, {{company}}, {{email}} with contact values
   */
  private interpolateVariables(template: string, contact?: ContactDocument | null): string {
    if (!contact || !template) return template;
    let result = template;

    const fields: Record<string, any> = {
      fullName: contact.fullName || '',
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phoneNumber: contact.phoneNumber || '',
      company: contact.company || '',
      website: contact.website || '',
      city: contact.city || '',
      country: contact.country || '',
      designation: contact.designation || '',
      leadSource: contact.leadSource || '',
      ...(contact.customFields || {}),
    };

    for (const [key, val] of Object.entries(fields)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      result = result.replace(pattern, String(val || ''));
    }

    return result;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
