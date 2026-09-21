import { IsArray, IsEmail, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateContactDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address format' })
  email?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid alternate email address format' })
  alternateEmail?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsIn(['lead', 'prospect', 'customer', 'active', 'inactive'], {
    message: 'Status must be one of: lead, prospect, customer, active, inactive',
  })
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  leadSource?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

