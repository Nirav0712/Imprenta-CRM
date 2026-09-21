import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';

@Controller('api/custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  async findAll() {
    return this.customFieldsService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateCustomFieldDto) {
    return this.customFieldsService.create(dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.customFieldsService.delete(id);
    return { success: true, message: 'Custom field deleted successfully' };
  }
}
