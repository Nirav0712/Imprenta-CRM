import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { SmtpTransportFactory } from './adapters/smtp-transport.factory';
import { ImapSyncService } from './adapters/imap-sync.service';

@Module({
  controllers: [EmailController],
  providers: [EmailService, SmtpTransportFactory, ImapSyncService],
  exports: [EmailService, SmtpTransportFactory, ImapSyncService],
})
export class EmailModule {}
