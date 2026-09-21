import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateEmailAccountDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  emailAddress: string;

  @IsNotEmpty()
  @IsEnum(['gmail', 'outlook', 'zoho', 'smtp_imap', 'other'])
  provider: string;

  @IsNotEmpty()
  @IsString()
  senderName: string;

  @IsNotEmpty()
  @IsString()
  passwordOrToken: string;

  @IsNotEmpty()
  @IsString()
  smtpHost: string;

  @IsNotEmpty()
  @IsInt()
  smtpPort: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  imapHost?: string;

  @IsOptional()
  @IsInt()
  imapPort?: number;

  @IsOptional()
  @IsBoolean()
  imapSecure?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  hourlyLimit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyLimit?: number = 500;
}

export class UpdateEmailAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  passwordOrToken?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  imapHost?: string;

  @IsOptional()
  @IsInt()
  imapPort?: number;

  @IsOptional()
  @IsBoolean()
  imapSecure?: boolean;

  @IsOptional()
  @IsEnum(['active', 'disabled', 'rate_limited'])
  status?: string;

  @IsOptional()
  @IsInt()
  hourlyLimit?: number;

  @IsOptional()
  @IsInt()
  dailyLimit?: number;
}

export class SendEmailDto {
  @IsNotEmpty()
  @IsString()
  accountId: string;

  @IsNotEmpty()
  @IsEmail()
  toEmail: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsNotEmpty()
  @IsString()
  subject: string;

  @IsNotEmpty()
  @IsString()
  bodyHtml: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  cc?: string[];

  @IsOptional()
  bcc?: string[];

  @IsOptional()
  attachments?: Array<{
    filename: string;
    contentType?: string;
    content?: string;
    url?: string;
    size?: number;
  }>;
}
