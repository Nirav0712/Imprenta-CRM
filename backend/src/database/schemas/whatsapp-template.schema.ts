import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type WhatsAppTemplateDocument = WhatsAppTemplate & Document;

@Schema({ timestamps: true, collection: 'whatsapp_templates' })
export class WhatsAppTemplate {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WhatsAppConnection', required: true, index: true })
  connectionId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, index: true })
  templateId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  language: string;

  @Prop({ required: true, enum: ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'], default: 'PENDING' })
  status: string;

  @Prop({ type: Array, default: [] })
  components: Array<{
    type: string;
    format?: string;
    text?: string;
    example?: any;
    buttons?: any[];
  }>;

  @Prop({ type: [String], default: [] })
  variables: string[];
}

export const WhatsAppTemplateSchema = SchemaFactory.createForClass(WhatsAppTemplate);
WhatsAppTemplateSchema.index({ connectionId: 1, name: 1, language: 1 }, { unique: true });
