import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class WhatsAppCampaignConfigDto {
  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsObject()
  variableMapping?: Record<string, string>;

  @IsOptional()
  @IsString()
  customMessageBody?: string;
}

export class EmailCampaignConfigDto {
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  accountIds: string[];

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
  @IsEnum(['round_robin', 'least_used'])
  rotationStrategy?: 'round_robin' | 'least_used' = 'round_robin';
}

export class SendingPolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  perMessageDelaySec?: number = 2;

  @IsOptional()
  @IsNumber()
  @Min(1)
  batchSize?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  batchPauseSec?: number = 60;
}

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(['whatsapp', 'email'])
  channel: 'whatsapp' | 'email';

  @IsOptional()
  @IsObject()
  contactFilters?: {
    city?: string;
    country?: string;
    leadSource?: string;
    company?: string;
    search?: string;
    contactIds?: string[]; // Direct contact selection
  };

  @IsOptional()
  @IsObject()
  whatsappConfig?: WhatsAppCampaignConfigDto;

  @IsOptional()
  @IsObject()
  emailConfig?: EmailCampaignConfigDto;

  @IsOptional()
  @IsObject()
  sendingPolicy?: SendingPolicyDto;
}
