import { Controller, Get, Patch, Put, Post, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SendingSetting } from '../../database/schemas/sending-setting.schema';
import { ThemeSetting } from '../../database/schemas/theme-setting.schema';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  async updateSettings(@Body() dto: Partial<SendingSetting>) {
    return this.settingsService.updateSettings(dto);
  }

  // ================= THEME CUSTOMIZER ENDPOINTS =================

  @Get('theme')
  async getTheme() {
    return this.settingsService.getTheme();
  }

  @Patch('theme')
  async updateTheme(@Body() dto: Partial<ThemeSetting>) {
    return this.settingsService.updateTheme(dto);
  }

  @Put('theme')
  async putTheme(@Body() dto: Partial<ThemeSetting>) {
    return this.settingsService.updateTheme(dto);
  }

  @Post('theme/reset')
  async resetTheme() {
    return this.settingsService.resetTheme();
  }
}
