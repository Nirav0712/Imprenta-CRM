import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ThemeSettingDocument = ThemeSetting & Document;

export type ThemeMode = 'light' | 'dark' | 'custom';
export type HeaderStyle = 'DEFAULT' | 'GLASS' | 'SOLID' | 'CINEMATIC';

@Schema({ timestamps: true, collection: 'theme_settings' })
export class ThemeSetting {
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  @Prop({ type: String, enum: ['light', 'dark', 'custom'], default: 'light' })
  mode: ThemeMode;

  @Prop({ default: '#10b981' })
  primaryColor: string;

  @Prop({ default: '#0f172a' })
  secondaryColor: string;

  @Prop({ default: '#06b6d4' })
  accentColor: string;

  @Prop({ default: '#f8fafc' })
  backgroundColor: string;

  @Prop({ default: '#ffffff' })
  surfaceColor: string;

  @Prop({ default: '#0f172a' })
  textColor: string;

  @Prop({ default: '#64748b' })
  mutedTextColor: string;

  @Prop({ default: '#e2e8f0' })
  borderColor: string;

  @Prop({
    type: String,
    enum: ['DEFAULT', 'GLASS', 'SOLID', 'CINEMATIC'],
    default: 'DEFAULT',
  })
  headerStyle: HeaderStyle;

  @Prop({ default: true })
  stickyHeader: boolean;

  @Prop({ default: false })
  topColorBar: boolean;

  @Prop({ default: 'md' })
  borderRadius: string;

  @Prop({ default: 'sm' })
  shadow: string;
}

export const ThemeSettingSchema = SchemaFactory.createForClass(ThemeSetting);
