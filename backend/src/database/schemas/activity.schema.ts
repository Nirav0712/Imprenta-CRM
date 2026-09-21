import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityDocument = Activity & Document;

export type ActivityType = 'whatsapp' | 'email' | 'call' | 'meeting' | 'note' | 'deal_update';

@Schema({ timestamps: true, collection: 'crm_activities' })
export class Activity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: true, index: true })
  contactId: Types.ObjectId;

  @Prop({ trim: true, default: 'default-org', index: true })
  organizationId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lead', index: true })
  leadId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['whatsapp', 'email', 'call', 'meeting', 'note', 'deal_update'],
    required: true,
  })
  type: ActivityType;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop({ default: 'System' })
  createdBy: string;

  @Prop({ type: Date, default: Date.now, index: true })
  performedAt: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
ActivitySchema.index({ organizationId: 1, performedAt: -1 });
ActivitySchema.index({ organizationId: 1, contactId: 1 });
ActivitySchema.index({ contactId: 1, performedAt: -1 });
