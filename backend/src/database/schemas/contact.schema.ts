import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ContactDocument = Contact & Document;

@Schema({ timestamps: true, collection: 'contacts' })
export class Contact {
  @Prop({ trim: true })
  firstName: string;

  @Prop({ trim: true })
  lastName: string;

  @Prop({ trim: true })
  fullName: string;

  @Prop({ trim: true, index: true })
  phoneNumber: string;

  @Prop({ trim: true, lowercase: true, index: true })
  email: string;

  @Prop({ trim: true })
  company: string;

  @Prop({ trim: true })
  website: string;

  @Prop({ trim: true })
  city: string;

  @Prop({ trim: true })
  country: string;

  @Prop({ trim: true })
  designation: string;

  @Prop({ trim: true })
  department: string;

  @Prop({ trim: true, index: true })
  whatsappNumber: string;

  @Prop({ trim: true, lowercase: true, index: true })
  alternateEmail: string;

  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @Prop({ trim: true, index: true })
  owner: string;

  @Prop({
    type: String,
    enum: ['lead', 'prospect', 'customer', 'active', 'inactive'],
    default: 'lead',
    index: true,
  })
  status: string;

  @Prop({ trim: true })
  notes: string;

  @Prop({ trim: true, default: 'default-org', index: true })
  organizationId: string;

  @Prop({ trim: true })
  leadSource: string;

  @Prop({ type: Object, default: {} })
  customFields: Record<string, any>;

  @Prop({ type: Object, default: { type: 'manual' } })
  source: {
    type: 'manual' | 'import';
    importJobId?: Types.ObjectId;
  };

  @Prop({
    type: [
      {
        field: { type: String, required: true },
        value: { type: String, required: true },
        potentialDuplicateOf: { type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: true },
      },
    ],
    default: [],
  })
  duplicateFlags: Array<{
    field: string;
    value: string;
    potentialDuplicateOf: Types.ObjectId;
  }>;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
ContactSchema.index({ organizationId: 1, email: 1 });
ContactSchema.index({ organizationId: 1, phoneNumber: 1 });
ContactSchema.index({ organizationId: 1, whatsappNumber: 1 });
ContactSchema.index({ organizationId: 1, status: 1 });
ContactSchema.index({ organizationId: 1, createdAt: -1 });
ContactSchema.index({
  fullName: 'text',
  company: 'text',
  email: 'text',
  phoneNumber: 'text',
  department: 'text',
  designation: 'text',
});
