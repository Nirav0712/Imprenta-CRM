import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type FollowUpDocument = FollowUp & Document;

export type FollowUpStatus = 'pending' | 'completed' | 'overdue' | 'cancelled';
export type FollowUpPriority = 'low' | 'medium' | 'high';

@Schema({ timestamps: true, collection: 'crm_follow_ups' })
export class FollowUp {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: true, index: true })
  contactId: Types.ObjectId;

  @Prop({ trim: true, default: 'default-org', index: true })
  organizationId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lead', index: true })
  leadId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ required: true, type: Date, index: true })
  dueDate: Date;

  @Prop({
    type: String,
    enum: ['pending', 'completed', 'overdue', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: FollowUpStatus;

  @Prop({
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  })
  priority: FollowUpPriority;

  @Prop({ trim: true })
  assignedTo?: string;

  @Prop({ type: Date })
  completedAt?: Date;
}

export const FollowUpSchema = SchemaFactory.createForClass(FollowUp);
FollowUpSchema.index({ organizationId: 1, status: 1, dueDate: 1 });
FollowUpSchema.index({ dueDate: 1, status: 1 });
