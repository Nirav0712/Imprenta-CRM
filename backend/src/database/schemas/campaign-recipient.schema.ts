import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CampaignRecipientDocument = CampaignRecipient & Document;

@Schema({ timestamps: true, collection: 'campaign_recipients' })
export class CampaignRecipient {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Campaign', required: true, index: true })
  campaignId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: true, index: true })
  contactId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  recipientIdentifier: string; // phone number or email

  @Prop({
    required: true,
    enum: ['pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'EmailAccount', required: false })
  assignedEmailAccountId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WhatsAppConnection', required: false })
  assignedWhatsAppConnectionId?: MongooseSchema.Types.ObjectId;

  @Prop({ trim: true })
  providerMessageId: string;

  @Prop()
  sentAt: Date;

  @Prop()
  deliveredAt: Date;

  @Prop()
  readAt: Date;

  @Prop()
  errorMessage: string;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop({ unique: true, sparse: true })
  idempotencyKey: string;
}

export const CampaignRecipientSchema = SchemaFactory.createForClass(CampaignRecipient);
CampaignRecipientSchema.index({ campaignId: 1, status: 1 });
CampaignRecipientSchema.index({ campaignId: 1, contactId: 1 }, { unique: true });
