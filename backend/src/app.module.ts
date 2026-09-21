import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { CryptoModule } from './common/crypto/crypto.module';
import { DatabaseModule } from './database/database.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { ImportsModule } from './modules/imports/imports.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { EmailModule } from './modules/email/email.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { SendingModule } from './modules/sending/sending.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CrmModule } from './modules/crm/crm.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppController } from './app.controller';
import { APP_GUARD } from '@nestjs/core';
import { TenantAuthGuard } from './common/guards/tenant-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env'],
    }),
    CryptoModule,
    DatabaseModule,
    AuthModule,
    ContactsModule,
    CustomFieldsModule,
    ImportsModule,
    WhatsAppModule,
    EmailModule,
    InboxModule,
    CampaignsModule,
    SendingModule,
    SettingsModule,
    CrmModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: TenantAuthGuard,
    },
  ],
})
export class AppModule {}
