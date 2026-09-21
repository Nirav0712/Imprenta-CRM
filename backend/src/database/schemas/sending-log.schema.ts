import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SendingLogDocument = SendingLog & Document;

@Schema({ timestamps: true, collection: 'sending_logs' })
export class SendingLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Campaign', required: false, index: true })
  campaignId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: false, index: true })
  contactId?: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['whatsapp', 'email'] })
  channel: string;

  @Prop({ required: true, trim: true })
  recipient: string;

  @Prop({ required: true, enum: ['success', 'failed', 'rate_limited', 'retry'] })
  status: string;

  @Prop({ trim: true })
  providerMessageId: string;

  @Prop({ type: Object })
  details: Record<string, any>;

  @Prop()
  errorMessage: string;

  @Prop({ default: Date.now, index: true })
  timestamp: Date;
}

export const SendingLogSchema = SchemaFactory.createForClass(SendingLog);
SendingLogSchema.index({ channel: 1, timestamp: -1 });
SendingLogSchema.index({ status: 1, timestamp: -1 });
