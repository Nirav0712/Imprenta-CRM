import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';

@Controller('api/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  private resolveOrgId(headerOrgId?: string, queryOrgId?: string): string {
    return headerOrgId || queryOrgId || 'default-org';
  }

  @Get('stats')
  async getStats(@Headers('x-organization-id') orgHeader?: string, @Query('organizationId') orgQuery?: string) {
    const orgId = this.resolveOrgId(orgHeader, orgQuery);
    return this.contactsService.getStats(orgId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query() query: FilterContactsDto,
    @Headers('x-organization-id') orgHeader?: string,
    @Res() res?: Response,
  ) {
    const orgId = this.resolveOrgId(orgHeader, query.organizationId);
    const csvData = await this.contactsService.exportCsv(query, orgId);
    const filename = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;

    if (res) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.status(200).send(csvData);
    }
    return csvData;
  }

  @Get()
  async findAll(
    @Query() query: FilterContactsDto,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    const orgId = this.resolveOrgId(orgHeader, query.organizationId);
    return this.contactsService.findAll(query, orgId);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
    @Query('organizationId') orgQuery?: string,
  ) {
    const orgId = this.resolveOrgId(orgHeader, orgQuery);
    return this.contactsService.findById(id, orgId);
  }

  @Post()
  async create(
    @Body() dto: CreateContactDto,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    const orgId = this.resolveOrgId(orgHeader, dto.organizationId);
    return this.contactsService.create(dto, orgId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    const orgId = this.resolveOrgId(orgHeader, dto.organizationId);
    return this.contactsService.update(id, dto, orgId);
  }

  @Delete('bulk')
  async deleteMany(
    @Body('ids') ids: string[],
    @Headers('x-organization-id') orgHeader?: string,
    @Query('organizationId') orgQuery?: string,
  ) {
    const orgId = this.resolveOrgId(orgHeader, orgQuery);
    return this.contactsService.deleteMany(ids || [], orgId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
    @Query('organizationId') orgQuery?: string,
  ) {
    const orgId = this.resolveOrgId(orgHeader, orgQuery);
    await this.contactsService.delete(id, orgId);
    return { success: true, message: 'Contact deleted successfully' };
  }
}
