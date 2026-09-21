import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ImportMappingDocument = ImportMapping & Document;

@Schema({ timestamps: true, collection: 'import_mappings' })
export class ImportMapping {
  @Prop({ trim: true, default: 'default-org', index: true })
  organizationId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Object, required: true })
  mapping: Record<string, string>;
}

export const ImportMappingSchema = SchemaFactory.createForClass(ImportMapping);
ImportMappingSchema.index({ organizationId: 1, name: 1 });
