import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CrmService, CreateLeadDto, UpdateLeadDto, CreateActivityDto, CreateFollowUpDto, UpdateFollowUpDto } from './crm.service';

@Controller('api/crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ================= LEADS & PIPELINE =================

  @Get('leads')
  async getLeads(@Query('stage') stage?: string, @Query('search') search?: string) {
    return this.crmService.getLeads(stage, search);
  }

  @Get('pipeline')
  async getPipelineSummary() {
    return this.crmService.getPipelineSummary();
  }

  @Post('leads')
  async createLead(@Body() dto: CreateLeadDto) {
    return this.crmService.createLead(dto);
  }

  @Patch('leads/:id')
  async updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.crmService.updateLead(id, dto);
  }

  @Delete('leads/:id')
  async deleteLead(@Param('id') id: string) {
    return this.crmService.deleteLead(id);
  }

  // ================= ACTIVITIES =================

  @Get('activities')
  async getActivities(
    @Query('contactId') contactId?: string,
    @Query('leadId') leadId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.crmService.getActivities(contactId, leadId, limit);
  }

  @Post('activities')
  async createActivity(@Body() dto: CreateActivityDto) {
    return this.crmService.createActivity(dto);
  }

  // ================= FOLLOW-UPS =================

  @Get('follow-ups')
  async getFollowUps(@Query('status') status?: string) {
    return this.crmService.getFollowUps(status);
  }

  @Post('follow-ups')
  async createFollowUp(@Body() dto: CreateFollowUpDto) {
    return this.crmService.createFollowUp(dto);
  }

  @Patch('follow-ups/:id')
  async updateFollowUp(@Param('id') id: string, @Body() dto: UpdateFollowUpDto) {
    return this.crmService.updateFollowUp(id, dto);
  }

  @Delete('follow-ups/:id')
  async deleteFollowUp(@Param('id') id: string) {
    return this.crmService.deleteFollowUp(id);
  }

  // ================= SOURCES =================

  @Get('sources')
  async getLeadSources() {
    return this.crmService.getLeadSources();
  }
}
