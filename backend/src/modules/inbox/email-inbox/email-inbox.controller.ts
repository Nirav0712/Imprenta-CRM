import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { EmailInboxService } from './email-inbox.service';

@Controller('api/inbox/email')
export class EmailInboxController {
  constructor(private readonly inboxService: EmailInboxService) {}

  @Get('conversations')
  async getConversations(
    @Query('accountId') accountId?: string,
    @Query('folder') folder?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('label') label?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.inboxService.getConversations(
      accountId,
      folder || 'inbox',
      search,
      pageNum,
      limitNum,
      label,
    );
  }

  @Get('counts')
  async getCounts(@Query('accountId') accountId?: string) {
    return this.inboxService.getCounts(accountId);
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.inboxService.getMessages(id);
  }

  @Patch('conversations/:id')
  async updateConversation(
    @Param('id') id: string,
    @Body()
    body: {
      isRead?: boolean;
      isStarred?: boolean;
      isImportant?: boolean;
      folder?: string;
      labels?: string[];
      snoozedUntil?: Date | null;
      unreadCount?: number;
    },
  ) {
    return this.inboxService.updateConversation(id, body);
  }

  @Post('conversations/bulk')
  async bulkAction(
    @Body()
    body: {
      ids: string[];
      action: string;
      folder?: string;
      label?: string;
      isImportant?: boolean;
    },
  ) {
    return this.inboxService.bulkAction(body.ids, body.action, {
      folder: body.folder,
      label: body.label,
      isImportant: body.isImportant,
    });
  }

  @Delete('conversations/:id')
  async deleteConversation(@Param('id') id: string) {
    return this.inboxService.deleteConversation(id);
  }

  @Post('drafts')
  async saveDraft(@Body() draftDto: any) {
    return this.inboxService.saveDraft(draftDto);
  }

  @Post('conversations/:id/reply')
  async reply(
    @Param('id') id: string,
    @Body('subject') subject: string,
    @Body('bodyHtml') bodyHtml: string,
    @Body('cc') cc?: string[],
    @Body('bcc') bcc?: string[],
    @Body('attachments') attachments?: any[],
  ) {
    return this.inboxService.replyMessage(
      id,
      subject || '',
      bodyHtml,
      cc,
      bcc,
      attachments,
    );
  }
}
