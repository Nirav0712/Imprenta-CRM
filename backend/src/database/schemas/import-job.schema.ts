import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ImportJobDocument = ImportJob & Document;

@Schema({ timestamps: true, collection: 'import_jobs', suppressReservedKeysWarning: true })
export class ImportJob {
  @Prop({ required: true })
  filename: string;

  @Prop({ trim: true, default: 'default-org', index: true })
  organizationId: string;

  @Prop({ required: true, enum: ['csv', 'xlsx', 'xls', 'xml'] })
  fileFormat: string;

  @Prop({ default: 0 })
  totalRows: number;

  @Prop({ default: 0 })
  successfulRows: number;

  @Prop({ default: 0 })
  failedRows: number;

  @Prop({ default: 0 })
  warningCount: number;

  @Prop({ required: true, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' })
  status: string;

  @Prop({
    type: [
      {
        row: { type: Number, required: true },
        column: { type: String, required: false },
        message: { type: String, required: true },
      },
    ],
    default: [],
  })
  errors: Array<{
    row: number;
    column?: string;
    message: string;
  }>;

  @Prop({ type: Object, default: {} })
  columnMapping: Record<string, string>;
}

export const ImportJobSchema = SchemaFactory.createForClass(ImportJob);
