import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument, PipelineStage } from '../../database/schemas/lead.schema';
import { Activity, ActivityDocument, ActivityType } from '../../database/schemas/activity.schema';
import { FollowUp, FollowUpDocument, FollowUpStatus, FollowUpPriority } from '../../database/schemas/follow-up.schema';
import { Contact, ContactDocument } from '../../database/schemas/contact.schema';

export interface CreateLeadDto {
  contactId: string;
  title: string;
  stage?: PipelineStage;
  dealValue?: number;
  currency?: string;
  score?: number;
  source?: string;
  assignedTo?: string;
  notes?: string;
  tags?: string[];
  expectedCloseDate?: Date;
}

export interface UpdateLeadDto extends Partial<CreateLeadDto> {}

export interface CreateActivityDto {
  contactId: string;
  leadId?: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface CreateFollowUpDto {
  contactId: string;
  leadId?: string;
  title: string;
  notes?: string;
  dueDate: Date;
  priority?: FollowUpPriority;
  assignedTo?: string;
}

export interface UpdateFollowUpDto {
  title?: string;
  notes?: string;
  dueDate?: Date;
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  assignedTo?: string;
}

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(FollowUp.name)
    private readonly followUpModel: Model<FollowUpDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
  ) {}

  // ================= LEAD & PIPELINE MANAGEMENT =================

  async getLeads(stage?: string, search?: string) {
    const query: any = {};
    if (stage && stage !== 'all') {
      query.stage = stage;
    }
    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { source: { $regex: search.trim(), $options: 'i' } },
        { tags: { $in: [new RegExp(search.trim(), 'i')] } },
      ];
    }

    return this.leadModel
      .find(query)
      .populate('contactId', 'fullName email phoneNumber company city country')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async getPipelineSummary() {
    const stages: PipelineStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
    const leads = await this.leadModel
      .find()
      .populate('contactId', 'fullName email phoneNumber company')
      .sort({ updatedAt: -1 })
      .exec();

    const grouped: Record<PipelineStage, { leads: any[]; totalValue: number; count: number }> = {
      new: { leads: [], totalValue: 0, count: 0 },
      contacted: { leads: [], totalValue: 0, count: 0 },
      qualified: { leads: [], totalValue: 0, count: 0 },
      proposal: { leads: [], totalValue: 0, count: 0 },
      won: { leads: [], totalValue: 0, count: 0 },
      lost: { leads: [], totalValue: 0, count: 0 },
    };

    for (const lead of leads) {
      const stage = (lead.stage || 'new') as PipelineStage;
      if (grouped[stage]) {
        grouped[stage].leads.push(lead);
        grouped[stage].totalValue += lead.dealValue || 0;
        grouped[stage].count += 1;
      }
    }

    const totalPipelineValue = leads.reduce((sum, l) => sum + (l.dealValue || 0), 0);
    const totalDeals = leads.length;

    return {
      stages: grouped,
      totalPipelineValue,
      totalDeals,
    };
  }

  async createLead(dto: CreateLeadDto): Promise<LeadDocument> {
    if (!dto.contactId || !dto.title) {
      throw new BadRequestException('Contact ID and Lead Title are required');
    }

    const contact = await this.contactModel.findById(dto.contactId);
    if (!contact) {
      throw new NotFoundException(`Contact #${dto.contactId} not found`);
    }

    const lead = new this.leadModel({
      contactId: new Types.ObjectId(dto.contactId),
      title: dto.title.trim(),
      stage: dto.stage || 'new',
      dealValue: dto.dealValue || 0,
      currency: dto.currency || 'USD',
      score: dto.score !== undefined ? dto.score : 50,
      source: dto.source || contact.leadSource || 'direct',
      assignedTo: dto.assignedTo,
      notes: dto.notes,
      tags: dto.tags || [],
      expectedCloseDate: dto.expectedCloseDate,
      lastContactedAt: new Date(),
    });

    const saved = await lead.save();

    // Log Activity
    await this.createActivity({
      contactId: dto.contactId,
      leadId: String(saved._id),
      type: 'deal_update',
      title: `New Lead Created: ${dto.title}`,
      description: `Stage: ${saved.stage}, Value: $${saved.dealValue}`,
    });

    return this.leadModel.findById(saved._id).populate('contactId').exec() as any;
  }

  async updateLead(id: string, dto: UpdateLeadDto): Promise<LeadDocument> {
    const lead = await this.leadModel.findById(id);
    if (!lead) {
      throw new NotFoundException(`Lead #${id} not found`);
    }

    const oldStage = lead.stage;
    Object.assign(lead, dto);
    if (dto.contactId) {
      lead.contactId = new Types.ObjectId(dto.contactId);
    }
    const updated = await lead.save();

    if (dto.stage && dto.stage !== oldStage) {
      await this.createActivity({
        contactId: String(lead.contactId),
        leadId: id,
        type: 'deal_update',
        title: `Stage Changed to ${dto.stage.toUpperCase()}`,
        description: `Lead moved from ${oldStage} to ${dto.stage}`,
      });
    }

    return this.leadModel.findById(updated._id).populate('contactId').exec() as any;
  }

  async deleteLead(id: string) {
    const lead = await this.leadModel.findById(id);
    if (!lead) {
      throw new NotFoundException(`Lead #${id} not found`);
    }
    await this.leadModel.findByIdAndDelete(id);
    await this.activityModel.deleteMany({ leadId: new Types.ObjectId(id) });
    await this.followUpModel.deleteMany({ leadId: new Types.ObjectId(id) });
    return { success: true, message: `Lead #${id} deleted` };
  }

  // ================= ACTIVITIES TIMELINE =================

  async getActivities(contactId?: string, leadId?: string, limit = 50) {
    const query: any = {};
    if (contactId) {
      query.contactId = new Types.ObjectId(contactId);
    }
    if (leadId) {
      query.leadId = new Types.ObjectId(leadId);
    }

    return this.activityModel
      .find(query)
      .populate('contactId', 'fullName email phoneNumber company')
      .populate('leadId', 'title stage dealValue')
      .sort({ performedAt: -1 })
      .limit(Number(limit) || 50)
      .exec();
  }

  async createActivity(dto: CreateActivityDto): Promise<ActivityDocument> {
    const activity = new this.activityModel({
      contactId: new Types.ObjectId(dto.contactId),
      leadId: dto.leadId ? new Types.ObjectId(dto.leadId) : undefined,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      metadata: dto.metadata || {},
      createdBy: dto.createdBy || 'System',
      performedAt: new Date(),
    });
    return activity.save();
  }

  // ================= FOLLOW-UPS =================

  async getFollowUps(status?: string) {
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    return this.followUpModel
      .find(query)
      .populate('contactId', 'fullName email phoneNumber company')
      .populate('leadId', 'title stage')
      .sort({ dueDate: 1 })
      .exec();
  }

  async createFollowUp(dto: CreateFollowUpDto): Promise<FollowUpDocument> {
    if (!dto.contactId || !dto.title || !dto.dueDate) {
      throw new BadRequestException('Contact, title, and due date are required');
    }

    const followUp = new this.followUpModel({
      contactId: new Types.ObjectId(dto.contactId),
      leadId: dto.leadId ? new Types.ObjectId(dto.leadId) : undefined,
      title: dto.title.trim(),
      notes: dto.notes,
      dueDate: new Date(dto.dueDate),
      status: 'pending',
      priority: dto.priority || 'medium',
      assignedTo: dto.assignedTo,
    });

    const saved = await followUp.save();

    await this.createActivity({
      contactId: dto.contactId,
      leadId: dto.leadId,
      type: 'note',
      title: `Follow-up Scheduled: ${dto.title}`,
      description: `Due: ${new Date(dto.dueDate).toLocaleDateString()}`,
    });

    return this.followUpModel.findById(saved._id).populate('contactId').populate('leadId').exec() as any;
  }

  async updateFollowUp(id: string, dto: UpdateFollowUpDto): Promise<FollowUpDocument> {
    const followUp = await this.followUpModel.findById(id);
    if (!followUp) {
      throw new NotFoundException(`Follow-up #${id} not found`);
    }

    if (dto.status === 'completed' && followUp.status !== 'completed') {
      followUp.completedAt = new Date();
    }

    Object.assign(followUp, dto);
    if (dto.dueDate) {
      followUp.dueDate = new Date(dto.dueDate);
    }

    const updated = await followUp.save();
    return this.followUpModel.findById(updated._id).populate('contactId').populate('leadId').exec() as any;
  }

  async deleteFollowUp(id: string) {
    const followUp = await this.followUpModel.findById(id);
    if (!followUp) {
      throw new NotFoundException(`Follow-up #${id} not found`);
    }
    await this.followUpModel.findByIdAndDelete(id);
    return { success: true, message: `Follow-up #${id} deleted` };
  }

  // ================= LEAD SOURCES & ANALYTICS =================

  async getLeadSources() {
    const leads = await this.leadModel.find().exec();
    const sourceMap: Record<string, { count: number; totalValue: number; wonCount: number }> = {};

    for (const lead of leads) {
      const src = lead.source || 'direct';
      if (!sourceMap[src]) {
        sourceMap[src] = { count: 0, totalValue: 0, wonCount: 0 };
      }
      sourceMap[src].count += 1;
      sourceMap[src].totalValue += lead.dealValue || 0;
      if (lead.stage === 'won') {
        sourceMap[src].wonCount += 1;
      }
    }

    return Object.entries(sourceMap).map(([source, stats]) => ({
      source,
      ...stats,
      conversionRate: stats.count > 0 ? ((stats.wonCount / stats.count) * 100).toFixed(1) + '%' : '0%',
    }));
  }
}
