import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomFieldDocument = CustomField & Document;

@Schema({ timestamps: true, collection: 'custom_fields' })
export class CustomField {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, enum: ['text', 'number', 'date', 'boolean', 'select'], default: 'text' })
  type: string;

  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ default: false })
  required: boolean;
}

export const CustomFieldSchema = SchemaFactory.createForClass(CustomField);
