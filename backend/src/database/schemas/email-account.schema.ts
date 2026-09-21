import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailAccountDocument = EmailAccount & Document;

@Schema({ timestamps: true, collection: 'email_accounts' })
export class EmailAccount {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true, unique: true })
  emailAddress: string;

  @Prop({ required: true, enum: ['gmail', 'outlook', 'zoho', 'smtp_imap', 'other'], default: 'smtp_imap' })
  provider: string;

  @Prop({ required: true, trim: true })
  senderName: string;

  @Prop({ select: false, required: true }) // Encrypted with AES-256-GCM
  encryptedPassword: string;

  // SMTP Sending Config
  @Prop({ required: true, trim: true })
  smtpHost: string;

  @Prop({ required: true, default: 587 })
  smtpPort: number;

  @Prop({ default: false })
  smtpSecure: boolean;

  // IMAP Receiving Config
  @Prop({ trim: true })
  imapHost: string;

  @Prop({ default: 993 })
  imapPort: number;

  @Prop({ default: true })
  imapSecure: boolean;

  @Prop({
    required: true,
    enum: ['active', 'invalid_credentials', 'rate_limited', 'disabled', 'error'],
    default: 'active',
  })
  status: string;

  @Prop({ default: 'connected' })
  smtpStatus: string;

  @Prop({ default: 'not_configured' })
  imapStatus: string;

  @Prop({ default: 50 })
  hourlyLimit: number;

  @Prop({ default: 500 })
  dailyLimit: number;

  @Prop({ default: 0 })
  sentTodayCount: number;

  @Prop({ default: 0 })
  sentThisHourCount: number;

  @Prop()
  lastSentAt: Date;

  @Prop()
  lastSyncAt: Date;

  @Prop()
  errorMessage: string;

  @Prop()
  smtpErrorMessage: string;

  @Prop()
  imapErrorMessage: string;
}

export const EmailAccountSchema = SchemaFactory.createForClass(EmailAccount);
