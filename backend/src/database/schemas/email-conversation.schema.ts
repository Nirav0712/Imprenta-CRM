import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type EmailConversationDocument = EmailConversation & Document;

@Schema({ timestamps: true, collection: 'email_conversations' })
export class EmailConversation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'EmailAccount', required: true, index: true })
  accountId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: false, index: true })
  contactId?: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  customerEmail: string;

  @Prop({ trim: true })
  customerName: string;

  @Prop({ trim: true })
  subject: string;

  @Prop({ trim: true })
  snippet: string;

  @Prop({ default: 0 })
  unreadCount: number;

  @Prop({
    type: String,
    enum: ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'],
    default: 'inbox',
    index: true,
  })
  folder: string;

  @Prop({ default: false, index: true })
  isStarred: boolean;

  @Prop({ default: false, index: true })
  isImportant: boolean;

  @Prop({ type: Date, default: null, index: true })
  snoozedUntil?: Date | null;

  @Prop({ type: [String], default: [], index: true })
  labels: string[];

  @Prop({ default: false })
  hasAttachments: boolean;

  @Prop({ default: 1 })
  messageCount: number;

  @Prop({ default: Date.now, index: true })
  lastMessageAt: Date;
}

export const EmailConversationSchema = SchemaFactory.createForClass(EmailConversation);
EmailConversationSchema.index({ accountId: 1, customerEmail: 1 }, { unique: true });
EmailConversationSchema.index({ accountId: 1, folder: 1, lastMessageAt: -1 });
EmailConversationSchema.index({ accountId: 1, isStarred: 1 });

