import { ContactsService } from './contacts.service';

describe('ContactsService CRUD, Normalization, Multi-Tenancy & Export', () => {
  let service: ContactsService;
  let mockContactModel: any;

  beforeEach(() => {
    mockContactModel = function (dto: any) {
      return {
        ...dto,
        _id: 'mock_contact_id_123',
        save: jest.fn().mockResolvedValue({
          ...dto,
          _id: 'mock_contact_id_123',
        }),
      };
    };

    mockContactModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: '1',
          fullName: 'John Doe',
          email: 'john@example.com',
          alternateEmail: 'john.alt@example.com',
          phoneNumber: '+15551234567',
          whatsappNumber: '+15551234567',
          city: 'New York',
          country: 'USA',
          company: 'Acme',
          department: 'Engineering',
          designation: 'Senior Lead',
          status: 'lead',
          owner: 'Sarah Connor',
          tags: ['VIP', 'Automotive'],
          notes: 'Key decision maker',
          organizationId: 'org_1',
          leadSource: 'Web',
          duplicateFlags: [],
          createdAt: new Date('2026-01-01'),
        },
      ]),
    });

    mockContactModel.findOne = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        _id: '1',
        fullName: 'John Doe',
        email: 'john@example.com',
        phoneNumber: '+15551234567',
        organizationId: 'org_1',
        duplicateFlags: [],
        save: jest.fn().mockResolvedValue(true),
      }),
    });

    mockContactModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    mockContactModel.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        _id: '1',
        fullName: 'John Doe',
        email: 'john@example.com',
        phoneNumber: '+15551234567',
        organizationId: 'org_1',
        duplicateFlags: [],
        save: jest.fn().mockResolvedValue(true),
      }),
    });

    mockContactModel.findOneAndDelete = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: '1' }),
    });

    mockContactModel.deleteMany = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
    });

    mockContactModel.distinct = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(['Inbound', 'Event']),
    });

    mockContactModel.aggregate = jest.fn().mockResolvedValue([
      { _id: 'lead', count: 5 },
      { _id: 'customer', count: 2 },
    ]);

    service = new ContactsService(mockContactModel as any);
  });

  describe('Phone and Email Normalization', () => {
    it('should normalize international and local phone numbers', () => {
      expect(service.normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
      expect(service.normalizePhone('0044 7911 123456')).toBe('+447911123456');
      expect(service.normalizePhone('555-1234')).toBe('5551234');
      expect(service.normalizePhone('')).toBe('');
    });

    it('should normalize emails to lowercase trimmed format', () => {
      expect(service.normalizeEmail('  John.Doe@Example.COM  ')).toBe('john.doe@example.com');
      expect(service.normalizeEmail('')).toBe('');
    });
  });

  describe('Multi-Tenant Duplicate Detection', () => {
    it('should detect duplicate records within the same organization', async () => {
      mockContactModel.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'existing_id_1', email: 'john@example.com', phoneNumber: '+15551234567', organizationId: 'org_1' },
        ]),
      });

      const dups = await service.detectDuplicates('john@example.com', '+15551234567', undefined, undefined, 'org_1');
      expect(dups.length).toBeGreaterThan(0);
      expect(dups.some((d) => d.field === 'email')).toBe(true);
      expect(dups.some((d) => d.field === 'phoneNumber')).toBe(true);
    });

    it('should return empty flags if no matching contact is found in the tenant', async () => {
      mockContactModel.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const dups = await service.detectDuplicates('unique@example.com', '+19998887777', undefined, undefined, 'org_1');
      expect(dups).toEqual([]);
    });
  });

  describe('Contact CRUD & Multi-Tenancy Scoping', () => {
    it('should create a contact with all CRM fields and tenant organizationId', async () => {
      const contact = await service.create(
        {
          firstName: 'Alice',
          lastName: 'Wonderland',
          email: '  Alice@Example.com ',
          alternateEmail: 'alice2@example.com',
          phoneNumber: '+1 (555) 999-0000',
          whatsappNumber: '+1 (555) 999-0000',
          department: 'Product',
          designation: 'VP Product',
          status: 'prospect',
          tags: ['Tech', 'Enterprise'],
          notes: 'Interested in annual plan',
          organizationId: 'org_custom',
        },
        'org_custom',
      );

      expect(contact.fullName).toBe('Alice Wonderland');
      expect(contact.email).toBe('alice@example.com');
      expect(contact.alternateEmail).toBe('alice2@example.com');
      expect(contact.phoneNumber).toBe('+15559990000');
      expect(contact.whatsappNumber).toBe('+15559990000');
      expect(contact.department).toBe('Product');
      expect(contact.status).toBe('prospect');
      expect(contact.organizationId).toBe('org_custom');
    });

    it('should paginate and filter contacts by tenant, status, department, and search', async () => {
      const result = await service.findAll(
        {
          page: 1,
          limit: 10,
          search: 'John',
          city: 'New York',
          department: 'Engineering',
          status: 'lead',
        },
        'org_1',
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(mockContactModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org_1', status: 'lead' }),
      );
    });

    it('should delete contacts scoped to organization', async () => {
      const res = await service.deleteMany(['1', '2'], 'org_1');
      expect(res.deletedCount).toBe(2);
      expect(mockContactModel.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org_1' }),
      );
    });
  });

  describe('CSV Export', () => {
    it('should generate valid RFC 4180 CSV export with UTF-8 BOM', async () => {
      const csv = await service.exportCsv({}, 'org_1');
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('"Full Name"');
      expect(csv).toContain('"Phone Number"');
      expect(csv).toContain('"WhatsApp Number"');
      expect(csv).toContain('"Email Address"');
      expect(csv).toContain('"Department"');
      expect(csv).toContain('"Status"');
      expect(csv).toContain('"John Doe"');
    });
  });
});
