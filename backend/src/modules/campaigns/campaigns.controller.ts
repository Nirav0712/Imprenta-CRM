import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('api/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.campaignsService.findById(id);
  }

  @Get(':id/recipients')
  async getRecipients(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.campaignsService.getRecipients(id, page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Get(':id/logs')
  async getLogs(@Param('id') id: string) {
    return this.campaignsService.getLogs(id);
  }

  @Post()
  async create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Post(':id/launch')
  async launch(@Param('id') id: string) {
    return this.campaignsService.launch(id);
  }

  @Post(':id/pause')
  async pause(@Param('id') id: string) {
    return this.campaignsService.pause(id);
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string) {
    return this.campaignsService.resume(id);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.campaignsService.cancel(id);
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.campaignsService.retryFailed(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.campaignsService.delete(id);
    return { success: true, message: 'Campaign deleted successfully' };
  }
}
