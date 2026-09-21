import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CrmService, CreateLeadDto, UpdateLeadDto, CreateActivityDto, CreateFollowUpDto, UpdateFollowUpDto } from './crm.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('api/crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ================= LEADS & PIPELINE =================

  @Get('leads')
  async getLeads(
    @CurrentTenant() orgId: string,
    @Query('stage') stage?: string,
    @Query('search') search?: string,
  ) {
    return this.crmService.getLeads(orgId, stage, search);
  }

  @Get('pipeline')
  async getPipelineSummary(@CurrentTenant() orgId: string) {
    return this.crmService.getPipelineSummary(orgId);
  }

  @Post('leads')
  async createLead(
    @CurrentTenant() orgId: string,
    @Body() dto: CreateLeadDto,
  ) {
    return this.crmService.createLead(dto, orgId);
  }

  @Patch('leads/:id')
  async updateLead(
    @Param('id') id: string,
    @CurrentTenant() orgId: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.crmService.updateLead(id, dto, orgId);
  }

  @Delete('leads/:id')
  async deleteLead(
    @Param('id') id: string,
    @CurrentTenant() orgId: string,
  ) {
    return this.crmService.deleteLead(id, orgId);
  }

  // ================= ACTIVITIES =================

  @Get('activities')
  async getActivities(
    @CurrentTenant() orgId: string,
    @Query('contactId') contactId?: string,
    @Query('leadId') leadId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.crmService.getActivities(orgId, contactId, leadId, limit);
  }

  @Post('activities')
  async createActivity(
    @CurrentTenant() orgId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.crmService.createActivity(dto, orgId);
  }

  // ================= FOLLOW-UPS =================

  @Get('follow-ups')
  async getFollowUps(
    @CurrentTenant() orgId: string,
    @Query('status') status?: string,
  ) {
    return this.crmService.getFollowUps(orgId, status);
  }

  @Post('follow-ups')
  async createFollowUp(
    @CurrentTenant() orgId: string,
    @Body() dto: CreateFollowUpDto,
  ) {
    return this.crmService.createFollowUp(dto, orgId);
  }

  @Patch('follow-ups/:id')
  async updateFollowUp(
    @Param('id') id: string,
    @CurrentTenant() orgId: string,
    @Body() dto: UpdateFollowUpDto,
  ) {
    return this.crmService.updateFollowUp(id, dto, orgId);
  }

  @Delete('follow-ups/:id')
  async deleteFollowUp(
    @Param('id') id: string,
    @CurrentTenant() orgId: string,
  ) {
    return this.crmService.deleteFollowUp(id, orgId);
  }

  // ================= SOURCES =================

  @Get('sources')
  async getLeadSources(@CurrentTenant() orgId: string) {
    return this.crmService.getLeadSources(orgId);
  }
}
