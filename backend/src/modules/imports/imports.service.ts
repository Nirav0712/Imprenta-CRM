import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ImportJob, ImportJobDocument } from '../../database/schemas/import-job.schema';
import { ImportMapping, ImportMappingDocument } from '../../database/schemas/import-mapping.schema';
import { ContactsService } from '../contacts/contacts.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { CsvParser, ParsedFileData } from './parsers/csv.parser';
import { ExcelParser } from './parsers/excel.parser';
import { SafeXmlParser } from './parsers/xml.parser';
import { ExecuteImportDto, PreviewImportDto } from './dto/execute-import.dto';

const STANDARD_FIELDS = [
  'fullName',
  'firstName',
  'lastName',
  'phoneNumber',
  'whatsappNumber',
  'email',
  'alternateEmail',
  'company',
  'department',
  'designation',
  'status',
  'owner',
  'leadSource',
  'city',
  'country',
  'website',
  'tags',
  'notes',
];

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    @InjectModel(ImportJob.name)
    private readonly importJobModel: Model<ImportJobDocument>,
    @InjectModel(ImportMapping.name)
    private readonly importMappingModel: Model<ImportMappingDocument>,
    private readonly contactsService: ContactsService,
    private readonly customFieldsService: CustomFieldsService,
  ) {}

  /**
   * Parses uploaded file buffer based on MIME type or filename extension
   */
  parseFile(filename: string, buffer: Buffer, mimetype?: string): ParsedFileData & { fileFormat: string } {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    let parsedData: ParsedFileData;
    let fileFormat = ext;

    try {
      if (ext === 'csv' || mimetype?.includes('csv') || mimetype?.includes('text/plain')) {
        parsedData = CsvParser.parse(buffer);
        fileFormat = 'csv';
      } else if (ext === 'xlsx' || ext === 'xls' || mimetype?.includes('spreadsheet') || mimetype?.includes('excel')) {
        parsedData = ExcelParser.parse(buffer);
        fileFormat = ext === 'xls' ? 'xls' : 'xlsx';
      } else if (ext === 'xml' || mimetype?.includes('xml')) {
        parsedData = SafeXmlParser.parse(buffer);
        fileFormat = 'xml';
      } else {
        throw new BadRequestException(`Unsupported file format .${ext}. Please upload a CSV, XLSX, XLS, or XML file.`);
      }
    } catch (err) {
      throw new BadRequestException(`Failed to parse file '${filename}': ${(err as Error).message}`);
    }

    if (parsedData.totalRows === 0) {
      throw new BadRequestException(`The uploaded file contains no data rows`);
    }

    return {
      ...parsedData,
      fileFormat,
    };
  }

  /**
   * Generates initial auto-guessed column mappings for headers
   */
  suggestMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    const aliasMap: Record<string, string> = {
      name: 'fullName',
      fullname: 'fullName',
      'full name': 'fullName',
      firstname: 'firstName',
      'first name': 'firstName',
      fname: 'firstName',
      lastname: 'lastName',
      'last name': 'lastName',
      lname: 'lastName',
      phone: 'phoneNumber',
      mobile: 'phoneNumber',
      'mobile number': 'phoneNumber',
      'mobile no': 'phoneNumber',
      'phone number': 'phoneNumber',
      cell: 'phoneNumber',
      whatsapp: 'phoneNumber',
      email: 'email',
      'email address': 'email',
      'work email': 'email',
      mail: 'email',
      company: 'company',
      'company name': 'company',
      organization: 'company',
      org: 'company',
      website: 'website',
      url: 'website',
      city: 'city',
      'city name': 'city',
      country: 'country',
      designation: 'designation',
      title: 'designation',
      'job title': 'designation',
      role: 'designation',
      source: 'leadSource',
      'lead source': 'leadSource',
    };

    for (const header of headers) {
      const cleanHeader = header.toLowerCase().trim().replace(/[-_]/g, ' ');
      if (aliasMap[cleanHeader]) {
        mapping[header] = aliasMap[cleanHeader];
      }
    }

    return mapping;
  }

  /**
   * Previews normalized data and calculates accurate validation stats
   */
  async previewMapping(dto: PreviewImportDto) {
    const { columnMapping, rows } = dto;
    const previewCount = Math.min(rows.length, 10);
    const previewRows: any[] = [];
    const errors: Array<{ row: number; column?: string; message: string }> = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let validRowsCount = 0;
    let invalidRowsCount = 0;
    let warningCount = 0;
    let duplicateCandidatesCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const rowNum = i + 1;
      const normalizedContact: Record<string, any> = { customFields: {} };
      let rowHasWarning = false;

      for (const [header, targetField] of Object.entries(columnMapping)) {
        if (!targetField || targetField === '__ignore__') continue;
        const rawValue = rawRow[header];
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        if (STANDARD_FIELDS.includes(targetField)) {
          if (targetField === 'email') {
            const emailVal = String(rawValue).trim().toLowerCase();
            if (emailVal && !emailRegex.test(emailVal)) {
              rowHasWarning = true;
              if (i < 50) {
                errors.push({ row: rowNum, column: header, message: `Invalid email format '${emailVal}'` });
              }
            }
            normalizedContact.email = emailVal;
          } else if (targetField === 'phoneNumber') {
            normalizedContact.phoneNumber = this.contactsService.normalizePhone(String(rawValue));
          } else {
            normalizedContact[targetField] = String(rawValue).trim();
          }
        } else {
          // Custom field
          normalizedContact.customFields[targetField] = rawValue;
        }
      }

      if (!normalizedContact.fullName && !normalizedContact.firstName && !normalizedContact.email && !normalizedContact.phoneNumber) {
        invalidRowsCount++;
        if (i < 50) {
          errors.push({ row: rowNum, message: 'Row skipped: missing name, phone, and email' });
        }
      } else {
        validRowsCount++;
        if (rowHasWarning) warningCount++;
      }

      if (i < previewCount) {
        // Check duplicate candidate in DB for preview sample
        const dups = await this.contactsService.detectDuplicates(normalizedContact.email, normalizedContact.phoneNumber);
        if (dups.length > 0) {
          duplicateCandidatesCount++;
          normalizedContact.isDuplicateCandidate = true;
        }
        previewRows.push(normalizedContact);
      }
    }

    return {
      previewRows,
      errors,
      totalRows: rows.length,
      validRowsCount,
      invalidRowsCount,
      warningCount,
      duplicateCandidatesCount,
    };
  }

  /**
   * Executes import and commits records to MongoDB Atlas
   */
  async executeImport(dto: ExecuteImportDto, orgId = 'default-org'): Promise<ImportJob> {
    const { filename, fileFormat, columnMapping, newCustomFields = [], rows } = dto;

    // 1. Create newly declared custom fields if any
    for (const fieldDef of newCustomFields) {
      try {
        await this.customFieldsService.createIfNotExists({
          key: fieldDef.key,
          label: fieldDef.label,
          type: fieldDef.type as any,
        });
      } catch (err) {
        this.logger.warn(`Could not register custom field '${fieldDef.key}': ${(err as Error).message}`);
      }
    }

    // 2. Initialize ImportJob record
    const importJob = new this.importJobModel({
      filename,
      organizationId: orgId,
      fileFormat,
      totalRows: rows.length,
      successfulRows: 0,
      failedRows: 0,
      warningCount: 0,
      status: 'processing',
      columnMapping,
      errors: [],
    });
    await importJob.save();

    let successfulRows = 0;
    let failedRows = 0;
    let warningCount = 0;
    const errors: Array<{ row: number; column?: string; message: string }> = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 3. Process rows
    for (let index = 0; index < rows.length; index++) {
      const rawRow = rows[index];
      const rowNum = index + 1;

      try {
        const contactData: Record<string, any> = { customFields: {}, organizationId: orgId };

        for (const [header, targetField] of Object.entries(columnMapping)) {
          if (!targetField || targetField === '__ignore__') continue;
          const rawValue = rawRow[header];
          if (rawValue === undefined || rawValue === null || rawValue === '') continue;

          if (STANDARD_FIELDS.includes(targetField)) {
            if (targetField === 'email') {
              const emailVal = String(rawValue).trim().toLowerCase();
              if (emailVal && !emailRegex.test(emailVal)) {
                warningCount++;
                errors.push({ row: rowNum, column: header, message: `Invalid email format '${emailVal}'` });
              }
              contactData.email = emailVal;
            } else if (targetField === 'phoneNumber') {
              contactData.phoneNumber = this.contactsService.normalizePhone(String(rawValue));
            } else {
              contactData[targetField] = String(rawValue).trim();
            }
          } else {
            contactData.customFields[targetField] = rawValue;
          }
        }

        // Validate that contact has at least a name, phone, or email
        if (!contactData.fullName && !contactData.firstName && !contactData.email && !contactData.phoneNumber) {
          failedRows++;
          errors.push({ row: rowNum, message: 'Row skipped: missing name, phone, and email' });
          continue;
        }

        await this.contactsService.create(
          contactData as any,
          orgId,
          {
            type: 'import',
            importJobId: importJob._id as any,
          },
        );

        successfulRows++;
      } catch (rowErr) {
        failedRows++;
        errors.push({ row: rowNum, message: (rowErr as Error).message });
      }
    }

    // 4. Update import job with final counts
    importJob.successfulRows = successfulRows;
    importJob.failedRows = failedRows;
    importJob.warningCount = warningCount;
    (importJob as any).errors = errors.slice(0, 100);
    importJob.status = failedRows === rows.length ? 'failed' : 'completed';
    return importJob.save();
  }

  async getImportHistory(orgId = 'default-org'): Promise<ImportJob[]> {
    return this.importJobModel.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(50).exec();
  }

  async getImportJobById(id: string, orgId = 'default-org'): Promise<ImportJob | null> {
    return this.importJobModel.findOne({ _id: id, organizationId: orgId }).exec();
  }

  // Reusable Mapping Presets
  async getSavedMappings(orgId = 'default-org'): Promise<ImportMapping[]> {
    return this.importMappingModel.find({ organizationId: orgId }).sort({ name: 1 }).exec();
  }

  async saveMapping(name: string, mapping: Record<string, string>, orgId = 'default-org'): Promise<ImportMapping> {
    const existing = await this.importMappingModel.findOne({ name, organizationId: orgId });
    if (existing) {
      existing.mapping = mapping;
      return existing.save();
    }
    const created = new this.importMappingModel({ name, mapping, organizationId: orgId });
    return created.save();
  }

  async deleteMapping(id: string, orgId = 'default-org'): Promise<void> {
    await this.importMappingModel.findOneAndDelete({ _id: id, organizationId: orgId }).exec();
  }
}
