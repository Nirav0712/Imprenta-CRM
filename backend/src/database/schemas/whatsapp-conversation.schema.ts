import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type WhatsAppConversationDocument = WhatsAppConversation & Document;

@Schema({ timestamps: true, collection: 'whatsapp_conversations' })
export class WhatsAppConversation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WhatsAppConnection', required: true, index: true })
  connectionId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: false, index: true })
  contactId?: MongooseSchema.Types.ObjectId;

  @Prop({ trim: true, index: true })
  remoteJid?: string;

  @Prop({ required: true, trim: true, index: true })
  customerPhoneNumber: string;

  @Prop({ trim: true })
  customerName: string;

  @Prop({ trim: true })
  lastMessageText: string;

  @Prop({ default: 0 })
  unreadCount: number;

  @Prop({ default: false, index: true })
  isPinned: boolean;

  @Prop({ default: false })
  isMuted: boolean;

  @Prop({ default: false, index: true })
  isArchived: boolean;

  @Prop({ default: '' })
  draftText: string;

  @Prop({ default: Date.now, index: true })
  lastActivityAt: Date;
}

export const WhatsAppConversationSchema = SchemaFactory.createForClass(WhatsAppConversation);
WhatsAppConversationSchema.index({ connectionId: 1, customerPhoneNumber: 1 }, { unique: true });
