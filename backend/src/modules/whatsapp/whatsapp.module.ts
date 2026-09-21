import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { OfficialWhatsAppAdapter } from './adapters/official/official-whatsapp.adapter';
import { RegularWhatsAppAdapter } from './adapters/regular/regular-whatsapp.adapter';
import { InMemoryLiveChatStore } from './stores/in-memory-live-chat.store';

@Module({
  controllers: [WhatsAppController],
  providers: [WhatsAppService, OfficialWhatsAppAdapter, RegularWhatsAppAdapter, InMemoryLiveChatStore],
  exports: [WhatsAppService, OfficialWhatsAppAdapter, RegularWhatsAppAdapter, InMemoryLiveChatStore],
})
export class WhatsAppModule {}
