import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { CreateEmailAccountDto, UpdateEmailAccountDto, SendEmailDto } from './dto/create-email-account.dto';

@Controller('api/email/accounts')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get()
  async findAll() {
    return this.emailService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.emailService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateEmailAccountDto) {
    return this.emailService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEmailAccountDto) {
    return this.emailService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.emailService.delete(id);
    return { success: true, message: 'Email account removed successfully' };
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string) {
    return this.emailService.testConnection(id);
  }

  @Post(':id/sync')
  async syncInbox(@Param('id') id: string) {
    return this.emailService.syncInbox(id);
  }

  @Post('send')
  async sendEmail(@Body() dto: SendEmailDto) {
    return this.emailService.sendEmail(dto);
  }
}
