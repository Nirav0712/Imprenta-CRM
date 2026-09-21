import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCustomFieldDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Key must be alphanumeric with underscores only' })
  key: string;

  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNotEmpty()
  @IsEnum(['text', 'number', 'date', 'boolean', 'select'])
  type: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
