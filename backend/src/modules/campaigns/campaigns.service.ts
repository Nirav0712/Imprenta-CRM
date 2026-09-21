import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Campaign, CampaignDocument } from '../../database/schemas/campaign.schema';
import { CampaignRecipient, CampaignRecipientDocument } from '../../database/schemas/campaign-recipient.schema';
import { Contact, ContactDocument } from '../../database/schemas/contact.schema';
import { SendingLog, SendingLogDocument } from '../../database/schemas/sending-log.schema';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignRecipient.name)
    private readonly recipientModel: Model<CampaignRecipientDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(SendingLog.name)
    private readonly sendingLogModel: Model<SendingLogDocument>,
  ) {}

  async findAll(): Promise<Campaign[]> {
    return this.campaignModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<CampaignDocument> {
    const campaign = await this.campaignModel.findById(id).exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign #${id} not found`);
    }
    return campaign;
  }

  /**
   * Resolves target contacts based on campaign filter criteria
   */
  async resolveTargetContacts(filters?: CreateCampaignDto['contactFilters'], channel?: 'whatsapp' | 'email'): Promise<ContactDocument[]> {
    const query: FilterQuery<ContactDocument> = {};

    if (channel === 'email') {
      query.email = { $exists: true, $ne: '' };
    } else if (channel === 'whatsapp') {
      query.phoneNumber = { $exists: true, $ne: '' };
    }

    if (filters) {
      if (filters.contactIds && filters.contactIds.length > 0) {
        query._id = { $in: filters.contactIds.map((id) => new Types.ObjectId(id)) };
      }
      if (filters.city) query.city = new RegExp(filters.city.trim(), 'i');
      if (filters.country) query.country = new RegExp(filters.country.trim(), 'i');
      if (filters.company) query.company = new RegExp(filters.company.trim(), 'i');
      if (filters.leadSource) query.leadSource = new RegExp(filters.leadSource.trim(), 'i');
      if (filters.search) {
        const regex = new RegExp(filters.search.trim(), 'i');
        query.$or = [{ fullName: regex }, { email: regex }, { phoneNumber: regex }];
      }
    }

    return this.contactModel.find(query).exec();
  }

  async create(dto: CreateCampaignDto): Promise<CampaignDocument> {
    const contacts = await this.resolveTargetContacts(dto.contactFilters, dto.channel);
    if (contacts.length === 0) {
      throw new BadRequestException(`No eligible contacts found matching the selected criteria for ${dto.channel} channel`);
    }

    const campaign = new this.campaignModel({
      name: dto.name,
      channel: dto.channel,
      status: 'draft',
      contactFilters: dto.contactFilters || {},
      totalRecipients: contacts.length,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      whatsappConfig: dto.whatsappConfig || {},
      emailConfig: dto.emailConfig || {},
      sendingPolicy: dto.sendingPolicy || { perMessageDelaySec: 2, batchSize: 50, batchPauseSec: 60 },
    });

    const saved = await campaign.save();

    // Create recipient records
    const recipientDocs = contacts.map((contact) => ({
      campaignId: saved._id,
      contactId: contact._id,
      recipientIdentifier: dto.channel === 'email' ? contact.email : contact.phoneNumber,
      status: 'pending',
    }));

    await this.recipientModel.insertMany(recipientDocs, { ordered: false });

    return saved;
  }

  async launch(id: string): Promise<CampaignDocument> {
    const campaign = await this.findById(id);
    if (campaign.status === 'completed' || campaign.status === 'running') {
      throw new BadRequestException(`Campaign is already ${campaign.status}`);
    }

    campaign.status = 'queued';
    campaign.errorMessage = '';
    return campaign.save();
  }

  async pause(id: string): Promise<CampaignDocument> {
    const campaign = await this.findById(id);
    if (campaign.status !== 'running' && campaign.status !== 'queued') {
      throw new BadRequestException(`Campaign cannot be paused in '${campaign.status}' state`);
    }

    campaign.status = 'paused';
    return campaign.save();
  }

  async resume(id: string): Promise<CampaignDocument> {
    const campaign = await this.findById(id);
    if (campaign.status !== 'paused') {
      throw new BadRequestException(`Campaign is not paused`);
    }

    campaign.status = 'queued';
    campaign.errorMessage = '';
    return campaign.save();
  }

  async cancel(id: string): Promise<CampaignDocument> {
    const campaign = await this.findById(id);
    campaign.status = 'cancelled';
    await this.recipientModel.updateMany(
      { campaignId: campaign._id, status: 'pending' },
      { $set: { status: 'cancelled' } },
    );
    return campaign.save();
  }

  async retryFailed(id: string): Promise<CampaignDocument> {
    const campaign = await this.findById(id);

    // Reset failed recipients to pending
    const result = await this.recipientModel.updateMany(
      { campaignId: campaign._id, status: 'failed' },
      { $set: { status: 'pending', errorMessage: undefined } },
    );

    campaign.failedCount = Math.max(0, campaign.failedCount - result.modifiedCount);
    campaign.status = 'queued';
    campaign.errorMessage = '';
    return campaign.save();
  }

  async getRecipients(id: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.recipientModel
        .find({ campaignId: new Types.ObjectId(id) })
        .populate('contactId', 'fullName email phoneNumber company')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.recipientModel.countDocuments({ campaignId: new Types.ObjectId(id) }).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getLogs(id: string, limit = 50) {
    return this.sendingLogModel
      .find({ campaignId: new Types.ObjectId(id) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async delete(id: string): Promise<void> {
    await this.campaignModel.findByIdAndDelete(id).exec();
    await this.recipientModel.deleteMany({ campaignId: new Types.ObjectId(id) }).exec();
    await this.sendingLogModel.deleteMany({ campaignId: new Types.ObjectId(id) }).exec();
  }
}
