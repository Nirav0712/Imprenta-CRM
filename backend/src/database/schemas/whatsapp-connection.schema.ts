import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhatsAppConnectionDocument = WhatsAppConnection & Document;

@Schema({ timestamps: true, collection: 'whatsapp_connections' })
export class WhatsAppConnection {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: ['official_meta', 'regular_qr'] })
  providerType: 'official_meta' | 'regular_qr';

  @Prop({
    required: true,
    enum: ['connected', 'disconnected', 'qr_ready', 'expired', 'error', 'connecting'],
    default: 'disconnected',
  })
  status: string;

  @Prop({ trim: true })
  phoneNumber: string;

  // Official Meta Business Platform fields
  @Prop({ trim: true })
  wabaId: string;

  @Prop({ trim: true })
  phoneId: string;

  @Prop({ trim: true })
  apiVersion: string;

  @Prop({ select: false }) // Encrypted with AES-256-GCM, hidden by default
  encryptedAccessToken: string;

  @Prop({ select: false }) // Encrypted with AES-256-GCM
  encryptedAppSecret: string;

  @Prop({ trim: true })
  webhookVerifyToken: string;

  // Regular WhatsApp QR fields
  @Prop()
  qrCodeData: string;

  @Prop({ type: Object, default: {} })
  sessionMetadata: Record<string, any>;

  @Prop()
  lastSeen: Date;

  @Prop()
  errorMessage: string;

  // Synchronization status fields
  @Prop({
    type: String,
    enum: ['idle', 'syncing', 'completed', 'partial', 'failed'],
    default: 'idle',
  })
  syncStatus: string;

  @Prop({ type: Date })
  lastSyncAt: Date;

  @Prop({ type: Object, default: { contactsCount: 0, chatsCount: 0, messagesCount: 0 } })
  syncStats: {
    contactsCount: number;
    chatsCount: number;
    messagesCount: number;
  };

  @Prop()
  syncError: string;
}

export const WhatsAppConnectionSchema = SchemaFactory.createForClass(WhatsAppConnection);
