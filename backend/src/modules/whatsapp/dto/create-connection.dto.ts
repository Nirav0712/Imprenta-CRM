import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWhatsAppConnectionDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(['official_meta', 'regular_qr'])
  providerType: 'official_meta' | 'regular_qr';

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  // Official Meta Fields
  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  phoneId?: string;

  @IsOptional()
  @IsString()
  apiVersion?: string = 'v20.0';

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsString()
  webhookVerifyToken?: string;
}

export class SendWhatsAppMessageDto {
  @IsNotEmpty()
  @IsString()
  connectionId: string;

  @IsNotEmpty()
  @IsString()
  recipientPhoneNumber: string;

  @IsOptional()
  @IsString()
  remoteJid?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsString()
  templateLanguage?: string = 'en_US';

  @IsOptional()
  templateVariables?: Record<string, string>; // e.g. { "1": "John", "2": "ACME" }

  @IsOptional()
  @IsString()
  customMessageBody?: string;

  @IsOptional()
  @IsString()
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'location' | 'contact' | 'reaction';

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  mediaBase64?: string;

  @IsOptional()
  @IsString()
  mimetype?: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  fileSize?: number;

  @IsOptional()
  duration?: number;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsOptional()
  contactData?: { displayName: string; vcard: string };

  @IsOptional()
  @IsString()
  quotedMessageId?: string;

  @IsOptional()
  @IsString()
  reactionEmoji?: string;

  @IsOptional()
  reactionKey?: { remoteJid?: string; id?: string; fromMe?: boolean };
}
