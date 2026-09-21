import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SendingSettingDocument = SendingSetting & Document;

@Schema({ timestamps: true, collection: 'sending_settings' })
export class SendingSetting {
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  @Prop({ default: 2 })
  defaultPerMessageDelaySec: number;

  @Prop({ default: 50 })
  defaultBatchSize: number;

  @Prop({ default: 60 })
  defaultBatchPauseSec: number;

  @Prop({ default: 500 })
  maxDailyEmailPerAccount: number;

  @Prop({ default: 50 })
  maxHourlyEmailPerAccount: number;

  @Prop({ default: 1000 })
  maxDailyWhatsAppPerConnection: number;

  @Prop({ default: 3 })
  maxRetries: number;

  @Prop({ default: true })
  autoRetryFailed: boolean;

  @Prop({ default: true })
  stopOnAccountExhaustion: boolean;
}

export const SendingSettingSchema = SchemaFactory.createForClass(SendingSetting);
