import { Module } from '@nestjs/common';
import { WhatsAppInboxService } from './whatsapp-inbox/whatsapp-inbox.service';
import { WhatsAppInboxController } from './whatsapp-inbox/whatsapp-inbox.controller';
import { EmailInboxService } from './email-inbox/email-inbox.service';
import { EmailInboxController } from './email-inbox/email-inbox.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [WhatsAppModule, EmailModule],
  controllers: [WhatsAppInboxController, EmailInboxController],
  providers: [WhatsAppInboxService, EmailInboxService],
  exports: [WhatsAppInboxService, EmailInboxService],
})
export class InboxModule {}
