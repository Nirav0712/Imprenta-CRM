import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { CreateWhatsAppConnectionDto, SendWhatsAppMessageDto } from './dto/create-connection.dto';

@Controller('api/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('connections')
  async getConnections() {
    return this.whatsappService.findAllConnections();
  }

  @Post('connections')
  async createConnection(@Body() dto: CreateWhatsAppConnectionDto) {
    return this.whatsappService.createConnection(dto);
  }

  @Post('connections/:id/test')
  async testConnection(@Param('id') id: string) {
    return this.whatsappService.testConnection(id);
  }

  @Get('connections/:id/status')
  async getConnectionStatus(@Param('id') id: string) {
    return this.whatsappService.findConnectionById(id);
  }

  @Post('connections/:id/confirm-pair')
  async confirmPairing(@Param('id') id: string) {
    return this.whatsappService.findConnectionById(id);
  }

  @Post('connections/:id/sync-templates')
  async syncTemplates(@Param('id') id: string) {
    return this.whatsappService.syncTemplates(id);
  }

  @Delete('connections/:id')
  async deleteConnection(@Param('id') id: string) {
    await this.whatsappService.deleteConnection(id);
    return { success: true, message: 'Connection deleted successfully' };
  }

  @Get('templates')
  async getTemplates(@Query('connectionId') connectionId?: string) {
    return this.whatsappService.getTemplates(connectionId);
  }

  @Post('send')
  async sendMessage(@Body() dto: SendWhatsAppMessageDto) {
    return this.whatsappService.sendMessage(dto);
  }

  /**
   * Meta Webhook Subscription Verification (GET)
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.whatsappService.verifyWebhook(mode, token, challenge);
  }

  @Get('meta/webhook')
  verifyMetaWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.whatsappService.verifyWebhook(mode, token, challenge);
  }

  /**
   * Meta Webhook Ingestion (POST)
   */
  @Post('webhook')
  async handleWebhook(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    return this.whatsappService.processWebhookEvent(body, signature);
  }

  @Post('meta/webhook')
  async handleMetaWebhook(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    return this.whatsappService.processWebhookEvent(body, signature);
  }
}
