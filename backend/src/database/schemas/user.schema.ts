import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: false, trim: true })
  name?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  salt: string;

  @Prop({ required: true, default: 'default-org', trim: true, index: true })
  organizationId: string;

  @Prop({ required: true, enum: ['owner', 'admin', 'member'], default: 'admin' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
