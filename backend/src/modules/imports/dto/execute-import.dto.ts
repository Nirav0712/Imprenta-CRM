import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CustomFieldDefinitionDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNotEmpty()
  @IsString()
  type: string;
}

export class ExecuteImportDto {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsNotEmpty()
  @IsString()
  fileFormat: string;

  @IsNotEmpty()
  @IsObject()
  columnMapping: Record<string, string>; // Maps file column header -> standard field or custom field key

  @IsOptional()
  @IsArray()
  newCustomFields?: CustomFieldDefinitionDto[];

  @IsNotEmpty()
  @IsArray()
  rows: Record<string, any>[];
}

export class PreviewImportDto {
  @IsNotEmpty()
  @IsObject()
  columnMapping: Record<string, string>;

  @IsNotEmpty()
  @IsArray()
  rows: Record<string, any>[];
}
