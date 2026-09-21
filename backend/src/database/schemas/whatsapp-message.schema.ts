import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type WhatsAppMessageDocument = WhatsAppMessage & Document;

@Schema({ timestamps: true, collection: 'whatsapp_messages' })
export class WhatsAppMessage {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WhatsAppConversation', required: true, index: true })
  conversationId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WhatsAppConnection', required: true, index: true })
  connectionId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: false, index: true })
  contactId?: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['inbound', 'outbound'] })
  direction: 'inbound' | 'outbound';

  @Prop({
    required: true,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ trim: true, index: true })
  providerMessageId: string;

  @Prop({ required: true })
  messageBody: string;

  @Prop({ trim: true })
  templateName: string;

  @Prop({ type: Object })
  templateVariables: Record<string, string>;

  @Prop()
  errorMessage: string;

  @Prop({ default: Date.now, index: true })
  timestamp: Date;
}

export const WhatsAppMessageSchema = SchemaFactory.createForClass(WhatsAppMessage);
WhatsAppMessageSchema.index({ conversationId: 1, timestamp: 1 });
WhatsAppMessageSchema.index({ connectionId: 1, providerMessageId: 1 }, { unique: true, sparse: true });
