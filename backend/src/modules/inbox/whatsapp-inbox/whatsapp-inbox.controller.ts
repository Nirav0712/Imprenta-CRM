import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { WhatsAppInboxService, StartConversationDto, UpdateConversationDto } from './whatsapp-inbox.service';

@Controller('api/inbox/whatsapp')
export class WhatsAppInboxController {
  constructor(private readonly inboxService: WhatsAppInboxService) {}

  @Get('conversations')
  async getConversations(
    @Query('connectionId') connectionId?: string,
    @Query('search') search?: string,
    @Query('filter') filter?: 'all' | 'unread' | 'pinned' | 'archived',
  ) {
    return this.inboxService.getConversations(connectionId, search, filter);
  }

  @Post('conversations/start')
  async startConversation(@Body() dto: StartConversationDto) {
    return this.inboxService.startConversation(dto);
  }

  @Patch('conversations/:id')
  async updateConversation(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.inboxService.updateConversation(id, dto);
  }

  @Delete('conversations/:id/messages')
  async clearMessages(@Param('id') id: string) {
    return this.inboxService.clearMessages(id);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.inboxService.getMessages(id, limit, before);
  }

  @Post('conversations/:id/reply')
  async reply(@Param('id') id: string, @Body() body: any) {
    if (typeof body === 'string') {
      return this.inboxService.replyMessage(id, body);
    }
    // Handle both { text: "hello" } legacy and rich ReplyWhatsAppDto
    return this.inboxService.replyMessage(id, body);
  }

  @Post('conversations/:id/react')
  async react(
    @Param('id') id: string,
    @Body() body: { emoji: string; messageId: string; fromMe?: boolean },
  ) {
    return this.inboxService.reactMessage(id, body.emoji, body.messageId, body.fromMe);
  }

  @Post('messages/:id/retry')
  async retryMessage(@Param('id') id: string) {
    return this.inboxService.retryMessage(id);
  }
}
