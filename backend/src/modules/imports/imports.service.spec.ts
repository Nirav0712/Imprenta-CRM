import { ImportsService } from './imports.service';

describe('ImportsService Column Mapping, Preview & Validation', () => {
  let service: ImportsService;
  let mockImportJobModel: any;
  let mockImportMappingModel: any;
  let mockContactsService: any;
  let mockCustomFieldsService: any;

  beforeEach(() => {
    mockImportJobModel = function (dto: any) {
      this._id = 'mock_import_job_1';
      Object.assign(this, dto);
      this.save = jest.fn().mockImplementation(async () => {
        return this;
      });
    };
    mockImportJobModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    mockImportJobModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    mockImportMappingModel = function (dto: any) {
      this._id = 'mock_mapping_id_1';
      Object.assign(this, dto);
      this.save = jest.fn().mockImplementation(async () => {
        return this;
      });
    };
    mockImportMappingModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    mockImportMappingModel.findOne = jest.fn().mockResolvedValue(null);
    mockImportMappingModel.findByIdAndDelete = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: '1' }),
    });

    mockContactsService = {
      normalizePhone: jest.fn((p) => p ? p.replace(/\s+/g, '') : ''),
      normalizeEmail: jest.fn((e) => e ? e.trim().toLowerCase() : ''),
      detectDuplicates: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ _id: 'created_contact_id' }),
    };

    mockCustomFieldsService = {
      createIfNotExists: jest.fn().mockResolvedValue({ key: 'custom_score', label: 'Score' }),
    };

    service = new ImportsService(
      mockImportJobModel as any,
      mockImportMappingModel as any,
      mockContactsService,
      mockCustomFieldsService,
    );
  });

  describe('Column Mapping Auto-Suggestion', () => {
    it('should intelligently map common header aliases to standard fields', () => {
      const headers = ['Full Name', 'Work Email', 'Mobile Number', 'Company Name', 'Job Title', 'City Name'];
      const mapping = service.suggestMapping(headers);

      expect(mapping['Full Name']).toBe('fullName');
      expect(mapping['Work Email']).toBe('email');
      expect(mapping['Mobile Number']).toBe('phoneNumber');
      expect(mapping['Company Name']).toBe('company');
      expect(mapping['Job Title']).toBe('designation');
      expect(mapping['City Name']).toBe('city');
    });
  });

  describe('Preview & Validation Calculations', () => {
    it('should detect valid, invalid, and warning rows accurately', async () => {
      const rows = [
        { Name: 'Valid User', Email: 'valid@example.com', Phone: '+1234567890' },
        { Name: 'Bad Email User', Email: 'invalid-email-address', Phone: '+1234567890' },
        { Name: '', Email: '', Phone: '' }, // Empty row -> invalid/skipped
      ];

      const mapping = {
        Name: 'fullName',
        Email: 'email',
        Phone: 'phoneNumber',
      };

      const result = await service.previewMapping({
        columnMapping: mapping,
        rows,
      });

      expect(result.totalRows).toBe(3);
      expect(result.validRowsCount).toBe(2);
      expect(result.invalidRowsCount).toBe(1);
      expect(result.warningCount).toBe(1); // Bad Email User triggered warning
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Execute Import & Custom Fields Creation', () => {
    it('should create new custom fields and insert records into database', async () => {
      const rows = [
        { Name: 'John Doe', Email: 'john@example.com', LeadScore: '95' },
      ];

      const result = await service.executeImport({
        filename: 'leads.csv',
        fileFormat: 'csv',
        columnMapping: {
          Name: 'fullName',
          Email: 'email',
          LeadScore: 'lead_score',
        },
        newCustomFields: [
          { key: 'lead_score', label: 'Lead Score', type: 'number' },
        ],
        rows,
      });

      expect(mockCustomFieldsService.createIfNotExists).toHaveBeenCalledTimes(1);
      expect(mockContactsService.create).toHaveBeenCalledTimes(1);
      expect(result.successfulRows).toBe(1);
      expect(result.failedRows).toBe(0);
      expect(result.status).toBe('completed');
    });
  });

  describe('Reusable Mapping Presets', () => {
    it('should save a reusable mapping preset', async () => {
      const preset = await service.saveMapping('Apollo Export', {
        'First Name': 'firstName',
        'Last Name': 'lastName',
        'Corporate Email': 'email',
      });

      expect(preset.name).toBe('Apollo Export');
    });
  });
});
