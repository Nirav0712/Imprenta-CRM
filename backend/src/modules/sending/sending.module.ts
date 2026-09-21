import { Module } from '@nestjs/common';
import { SendingQueueService } from './sending-queue.service';
import { EmailModule } from '../email/email.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [EmailModule, WhatsAppModule],
  providers: [SendingQueueService],
  exports: [SendingQueueService],
})
export class SendingModule {}
