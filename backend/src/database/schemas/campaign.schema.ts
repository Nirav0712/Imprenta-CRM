import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CampaignDocument = Campaign & Document;

@Schema({ timestamps: true, collection: 'campaigns' })
export class Campaign {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: ['whatsapp', 'email'] })
  channel: 'whatsapp' | 'email';

  @Prop({
    required: true,
    enum: ['draft', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'draft',
    index: true,
  })
  status: string;

  @Prop({ type: Object, default: {} })
  contactFilters: {
    city?: string;
    country?: string;
    leadSource?: string;
    company?: string;
    search?: string;
  };

  @Prop({ default: 0 })
  totalRecipients: number;

  @Prop({ default: 0 })
  sentCount: number;

  @Prop({ default: 0 })
  deliveredCount: number;

  @Prop({ default: 0 })
  readCount: number;

  @Prop({ default: 0 })
  failedCount: number;

  // WhatsApp Campaign Config
  @Prop({
    type: {
      connectionId: { type: MongooseSchema.Types.ObjectId, ref: 'WhatsAppConnection' },
      templateId: { type: String },
      templateName: { type: String },
      variableMapping: { type: Object, default: {} }, // e.g. { "1": "firstName", "2": "company" }
      customMessageBody: { type: String }, // For regular QR WhatsApp
    },
    default: {},
  })
  whatsappConfig: {
    connectionId?: MongooseSchema.Types.ObjectId;
    templateId?: string;
    templateName?: string;
    variableMapping?: Record<string, string>;
    customMessageBody?: string;
  };

  // Email Campaign Config
  @Prop({
    type: {
      accountIds: [{ type: MongooseSchema.Types.ObjectId, ref: 'EmailAccount' }],
      subject: { type: String },
      bodyHtml: { type: String },
      bodyText: { type: String },
      rotationStrategy: { type: String, enum: ['round_robin', 'least_used'], default: 'round_robin' },
    },
    default: {},
  })
  emailConfig: {
    accountIds: MongooseSchema.Types.ObjectId[];
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    rotationStrategy?: 'round_robin' | 'least_used';
  };

  // Sending Policy
  @Prop({
    type: {
      perMessageDelaySec: { type: Number, default: 2 },
      batchSize: { type: Number, default: 50 },
      batchPauseSec: { type: Number, default: 60 },
    },
    default: { perMessageDelaySec: 2, batchSize: 50, batchPauseSec: 60 },
  })
  sendingPolicy: {
    perMessageDelaySec: number;
    batchSize: number;
    batchPauseSec: number;
  };

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  errorMessage: string;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
