import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { SendingSetting, SendingSettingSchema } from '../../database/schemas/sending-setting.schema';
import { ThemeSetting, ThemeSettingSchema } from '../../database/schemas/theme-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SendingSetting.name, schema: SendingSettingSchema },
      { name: ThemeSetting.name, schema: ThemeSettingSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
