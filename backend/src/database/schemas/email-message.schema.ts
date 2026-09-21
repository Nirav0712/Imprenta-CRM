import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type EmailMessageDocument = EmailMessage & Document;

@Schema({ timestamps: true, collection: 'email_messages' })
export class EmailMessage {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'EmailConversation', required: true, index: true })
  conversationId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'EmailAccount', required: true, index: true })
  accountId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: false, index: true })
  contactId?: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['inbound', 'outbound'] })
  direction: 'inbound' | 'outbound';

  @Prop({ required: true, trim: true })
  from: string;

  @Prop({ required: true, trim: true })
  to: string;

  @Prop({ trim: true })
  subject: string;

  @Prop()
  bodyHtml: string;

  @Prop()
  bodyText: string;

  @Prop({
    required: true,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ type: [String], default: [] })
  cc: string[];

  @Prop({ type: [String], default: [] })
  bcc: string[];

  @Prop({
    type: [
      {
        filename: { type: String, required: true },
        contentType: { type: String, default: 'application/octet-stream' },
        size: { type: Number, default: 0 },
        url: { type: String, default: '' },
      },
    ],
    default: [],
  })
  attachments: Array<{
    filename: string;
    contentType: string;
    size?: number;
    url?: string;
  }>;

  @Prop({ default: false, index: true })
  isStarred: boolean;

  @Prop({ default: false, index: true })
  isDraft: boolean;

  @Prop({
    type: String,
    enum: ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'],
    default: 'inbox',
    index: true,
  })
  folder: string;

  @Prop({ trim: true, index: true })
  providerMessageId: string;

  @Prop()
  errorMessage: string;

  @Prop({ default: Date.now, index: true })
  date: Date;
}

export const EmailMessageSchema = SchemaFactory.createForClass(EmailMessage);
EmailMessageSchema.index({ conversationId: 1, date: 1 });
EmailMessageSchema.index({ accountId: 1, providerMessageId: 1 }, { unique: true, sparse: true });
