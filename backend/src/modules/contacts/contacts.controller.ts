import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('api/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get('stats')
  async getStats(@CurrentTenant() orgId: string) {
    return this.contactsService.getStats(orgId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query() query: FilterContactsDto,
    @CurrentTenant() orgId: string,
    @Res() res?: Response,
  ) {
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
    @CurrentTenant() orgId: string,
  ) {
    return this.contactsService.findAll(query, orgId);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentTenant() orgId: string,
  ) {
    return this.contactsService.findById(id, orgId);
  }

  @Post()
  async create(
    @Body() dto: CreateContactDto,
    @CurrentTenant() orgId: string,
  ) {
    return this.contactsService.create(dto, orgId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentTenant() orgId: string,
  ) {
    return this.contactsService.update(id, dto, orgId);
  }

  @Delete('bulk')
  async deleteMany(
    @Body('ids') ids: string[],
    @CurrentTenant() orgId: string,
  ) {
    return this.contactsService.deleteMany(ids || [], orgId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentTenant() orgId: string,
  ) {
    await this.contactsService.delete(id, orgId);
    return { success: true, message: 'Contact deleted successfully' };
  }
}
