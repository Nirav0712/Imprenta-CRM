import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type LeadDocument = Lead & Document;

export type PipelineStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';

@Schema({ timestamps: true, collection: 'crm_leads' })
export class Lead {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: true, index: true })
  contactId: Types.ObjectId;

  @Prop({ trim: true, default: 'default-org', index: true })
  organizationId: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'],
    default: 'new',
    index: true,
  })
  stage: PipelineStage;

  @Prop({ default: 0 })
  dealValue: number;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 50, min: 0, max: 100 })
  score: number;

  @Prop({ default: 'website' })
  source: string;

  @Prop({ trim: true })
  assignedTo?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Date })
  expectedCloseDate?: Date;

  @Prop({ type: Date, default: Date.now })
  lastContactedAt: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
LeadSchema.index({ organizationId: 1, stage: 1 });
LeadSchema.index({ organizationId: 1, createdAt: -1 });
LeadSchema.index({ stage: 1, dealValue: -1 });
