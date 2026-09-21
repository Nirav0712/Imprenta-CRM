import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SendingSetting, SendingSettingDocument } from '../../database/schemas/sending-setting.schema';
import { ThemeSetting, ThemeSettingDocument } from '../../database/schemas/theme-setting.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(SendingSetting.name)
    private readonly settingModel: Model<SendingSettingDocument>,
    @InjectModel(ThemeSetting.name)
    private readonly themeModel: Model<ThemeSettingDocument>,
  ) {}

  // ================= SENDING SETTINGS =================

  async getSettings(): Promise<SendingSettingDocument> {
    let settings = await this.settingModel.findOne({ key: 'global' }).exec();
    if (!settings) {
      settings = new this.settingModel({ key: 'global' });
      await settings.save();
    }
    return settings;
  }

  async updateSettings(dto: Partial<SendingSetting>): Promise<SendingSettingDocument> {
    const settings = await this.getSettings();
    Object.assign(settings, dto);
    return settings.save();
  }

  // ================= THEME CUSTOMIZER SETTINGS =================

  async getTheme(): Promise<ThemeSettingDocument> {
    let theme = await this.themeModel.findOne({ key: 'global' }).exec();
    if (!theme) {
      theme = new this.themeModel({
        key: 'global',
        mode: 'light',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        accentColor: '#06b6d4',
        backgroundColor: '#f8fafc',
        surfaceColor: '#ffffff',
        textColor: '#0f172a',
        mutedTextColor: '#64748b',
        borderColor: '#e2e8f0',
        headerStyle: 'DEFAULT',
        stickyHeader: true,
        topColorBar: false,
        borderRadius: 'md',
        shadow: 'sm',
      });
      await theme.save();
    }
    return theme;
  }

  async updateTheme(dto: Partial<ThemeSetting>): Promise<ThemeSettingDocument> {
    const theme = await this.getTheme();
    Object.assign(theme, dto);
    return theme.save();
  }

  async resetTheme(): Promise<ThemeSettingDocument> {
    const theme = await this.getTheme();
    theme.mode = 'light';
    theme.primaryColor = '#10b981';
    theme.secondaryColor = '#0f172a';
    theme.accentColor = '#06b6d4';
    theme.backgroundColor = '#f8fafc';
    theme.surfaceColor = '#ffffff';
    theme.textColor = '#0f172a';
    theme.mutedTextColor = '#64748b';
    theme.borderColor = '#e2e8f0';
    theme.headerStyle = 'DEFAULT';
    theme.stickyHeader = true;
    theme.topColorBar = false;
    theme.borderRadius = 'md';
    theme.shadow = 'sm';
    return theme.save();
  }
}
