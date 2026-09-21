import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type QueueJobDocument = QueueJob & Document;

@Schema({ timestamps: true, collection: 'queue_jobs' })
export class QueueJob {
  @Prop({ required: true, index: true })
  queue: string; // e.g. 'campaign_sending', 'inbox_sync'

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({
    required: true,
    enum: ['pending', 'running', 'completed', 'failed', 'paused', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: 3 })
  maxAttempts: number;

  @Prop({ default: Date.now, index: true })
  runAt: Date;

  @Prop()
  lockedAt: Date;

  @Prop()
  lockedBy: string;

  @Prop()
  completedAt: Date;

  @Prop()
  failedAt: Date;

  @Prop()
  lastError: string;

  @Prop({ unique: true, sparse: true })
  idempotencyKey: string;
}

export const QueueJobSchema = SchemaFactory.createForClass(QueueJob);
QueueJobSchema.index({ queue: 1, status: 1, runAt: 1 });
QueueJobSchema.index({ lockedAt: 1 });
