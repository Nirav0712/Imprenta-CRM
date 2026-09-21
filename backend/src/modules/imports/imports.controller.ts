import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { ExecuteImportDto, PreviewImportDto } from './dto/execute-import.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('api/imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const parsed = this.importsService.parseFile(file.originalname, file.buffer, file.mimetype);
    const suggestedMapping = this.importsService.suggestMapping(parsed.headers);

    return {
      filename: file.originalname,
      fileFormat: parsed.fileFormat,
      totalRows: parsed.totalRows,
      headers: parsed.headers,
      suggestedMapping,
      previewRows: parsed.previewRows,
      allRows: parsed.rows,
    };
  }

  @Post('preview')
  async previewMapping(@Body() dto: PreviewImportDto) {
    return this.importsService.previewMapping(dto);
  }

  @Post('execute')
  async executeImport(
    @CurrentTenant() orgId: string,
    @Body() dto: ExecuteImportDto,
  ) {
    return this.importsService.executeImport(dto, orgId);
  }

  @Get('history')
  async getHistory(@CurrentTenant() orgId: string) {
    return this.importsService.getImportHistory(orgId);
  }

  @Get('history/:id')
  async getJobById(
    @Param('id') id: string,
    @CurrentTenant() orgId: string,
  ) {
    return this.importsService.getImportJobById(id, orgId);
  }

  // Reusable Mapping Presets
  @Get('mappings')
  async getSavedMappings(@CurrentTenant() orgId: string) {
    return this.importsService.getSavedMappings(orgId);
  }

  @Post('mappings')
  async saveMapping(
    @CurrentTenant() orgId: string,
    @Body('name') name: string,
    @Body('mapping') mapping: Record<string, string>,
  ) {
    if (!name || !mapping) {
      throw new BadRequestException('Preset name and mapping are required');
    }
    return this.importsService.saveMapping(name, mapping, orgId);
  }

  @Delete('mappings/:id')
  async deleteMapping(
    @Param('id') id: string,
    @CurrentTenant() orgId: string,
  ) {
    await this.importsService.deleteMapping(id, orgId);
    return { success: true, message: 'Mapping preset deleted successfully' };
  }
}
