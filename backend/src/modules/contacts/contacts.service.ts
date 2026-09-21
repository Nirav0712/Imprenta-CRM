import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Contact, ContactDocument } from '../../database/schemas/contact.schema';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
  ) {}

  /**
   * Normalizes phone number to clean standard format (+CountryCodeDigits or clean digits)
   */
  normalizePhone(phone?: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    if (!cleaned.startsWith('+') && cleaned.length >= 10) {
      cleaned = cleaned.replace(/^00/, '+');
    }
    return cleaned;
  }

  /**
   * Normalizes email to lowercase trimmed
   */
  normalizeEmail(email?: string): string {
    return email ? email.trim().toLowerCase() : '';
  }

  /**
   * Finds potential duplicate contacts within the same organization without silently merging
   */
  async detectDuplicates(
    email?: string,
    phoneNumber?: string,
    whatsappNumber?: string,
    alternateEmail?: string,
    organizationId = 'default-org',
    excludeId?: string,
  ): Promise<Array<{ field: string; value: string; potentialDuplicateOf: Types.ObjectId }>> {
    const flags: Array<{ field: string; value: string; potentialDuplicateOf: Types.ObjectId }> = [];
    const normEmail = this.normalizeEmail(email);
    const normPhone = this.normalizePhone(phoneNumber);
    const normWhatsApp = this.normalizePhone(whatsappNumber);
    const normAltEmail = this.normalizeEmail(alternateEmail);

    const conditions: any[] = [];
    if (normEmail) conditions.push({ email: normEmail });
    if (normAltEmail) conditions.push({ alternateEmail: normAltEmail });
    if (normPhone) conditions.push({ phoneNumber: normPhone });
    if (normWhatsApp) conditions.push({ whatsappNumber: normWhatsApp });

    if (conditions.length === 0) return flags;

    const query: FilterQuery<ContactDocument> = {
      organizationId: organizationId || 'default-org',
      $or: conditions,
    };
    if (excludeId) {
      query._id = { $ne: new Types.ObjectId(excludeId) };
    }

    const matches = await this.contactModel.find(query).limit(10).exec();
    for (const match of matches) {
      const matchId = match._id as Types.ObjectId;
      if (normEmail && match.email === normEmail) {
        flags.push({ field: 'email', value: normEmail, potentialDuplicateOf: matchId });
      }
      if (normAltEmail && match.alternateEmail === normAltEmail) {
        flags.push({ field: 'alternateEmail', value: normAltEmail, potentialDuplicateOf: matchId });
      }
      if (normPhone && match.phoneNumber === normPhone) {
        flags.push({ field: 'phoneNumber', value: normPhone, potentialDuplicateOf: matchId });
      }
      if (normWhatsApp && match.whatsappNumber === normWhatsApp) {
        flags.push({ field: 'whatsappNumber', value: normWhatsApp, potentialDuplicateOf: matchId });
      }
    }

    return flags;
  }

  async create(
    dto: CreateContactDto,
    orgIdOrSource: string | { type: 'manual' | 'import'; importJobId?: Types.ObjectId } = 'default-org',
    sourceObj: { type: 'manual' | 'import'; importJobId?: Types.ObjectId } = { type: 'manual' },
  ): Promise<ContactDocument> {
    const orgId = typeof orgIdOrSource === 'string' ? orgIdOrSource : 'default-org';
    const source =
      typeof orgIdOrSource === 'object' && orgIdOrSource !== null ? orgIdOrSource : sourceObj;
    const organizationId = dto.organizationId || orgId || 'default-org';
    const normalizedPhone = this.normalizePhone(dto.phoneNumber);
    const normalizedWhatsApp = this.normalizePhone(dto.whatsappNumber || dto.phoneNumber);
    const normalizedEmail = this.normalizeEmail(dto.email);
    const normalizedAltEmail = this.normalizeEmail(dto.alternateEmail);

    const fullName =
      dto.fullName?.trim() ||
      `${dto.firstName || ''} ${dto.lastName || ''}`.trim() ||
      dto.company?.trim() ||
      'Unnamed Contact';

    const duplicateFlags = await this.detectDuplicates(
      normalizedEmail,
      normalizedPhone,
      normalizedWhatsApp,
      normalizedAltEmail,
      organizationId,
    );

    const contact = new this.contactModel({
      ...dto,
      fullName,
      phoneNumber: normalizedPhone,
      whatsappNumber: normalizedWhatsApp,
      email: normalizedEmail,
      alternateEmail: normalizedAltEmail,
      status: dto.status || 'lead',
      tags: dto.tags || [],
      organizationId,
      source,
      duplicateFlags,
    });

    return contact.save();
  }


  async findAll(filterDto: FilterContactsDto, orgId = 'default-org'): Promise<PaginatedResult<Contact>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      city,
      country,
      company,
      department,
      status,
      owner,
      tags,
      leadSource,
      hasDuplicateFlags,
      customFieldKey,
      customFieldValue,
      organizationId,
    } = filterDto;

    const activeOrgId = organizationId || orgId || 'default-org';
    const query: FilterQuery<ContactDocument> = { organizationId: activeOrgId };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: regex },
        { email: regex },
        { alternateEmail: regex },
        { phoneNumber: regex },
        { whatsappNumber: regex },
        { company: regex },
        { department: regex },
        { designation: regex },
      ];
    }

    if (city) query.city = new RegExp(city.trim(), 'i');
    if (country) query.country = new RegExp(country.trim(), 'i');
    if (company) query.company = new RegExp(company.trim(), 'i');
    if (department) query.department = new RegExp(department.trim(), 'i');
    if (status && status !== 'all') query.status = status.trim();
    if (owner && owner !== 'all') query.owner = new RegExp(owner.trim(), 'i');
    if (leadSource && leadSource !== 'all') query.leadSource = new RegExp(leadSource.trim(), 'i');

    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        query.tags = { $in: tagList };
      }
    }

    if (hasDuplicateFlags === 'true') {
      query['duplicateFlags.0'] = { $exists: true };
    }

    if (customFieldKey && customFieldValue) {
      query[`customFields.${customFieldKey}`] = new RegExp(customFieldValue.trim(), 'i');
    }

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [data, total] = await Promise.all([
      this.contactModel.find(query).sort(sort).skip(skip).limit(limit).exec(),
      this.contactModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id: string, orgId = 'default-org'): Promise<ContactDocument> {
    const query: FilterQuery<ContactDocument> = Types.ObjectId.isValid(id)
      ? { _id: new Types.ObjectId(id) }
      : { _id: id as any };

    if (orgId && orgId !== 'ALL') {
      query.organizationId = orgId;
    }

    const contact = await this.contactModel
      .findOne(query)
      .populate('duplicateFlags.potentialDuplicateOf', 'fullName email phoneNumber whatsappNumber company')
      .populate('source.importJobId', 'filename fileFormat createdAt totalRows successfulRows')
      .exec();

    if (!contact) {
      throw new NotFoundException(`Contact #${id} not found in this organization`);
    }
    return contact;
  }

  async update(id: string, dto: UpdateContactDto, orgId = 'default-org'): Promise<ContactDocument> {
    const existing = await this.findById(id, orgId);

    const organizationId = dto.organizationId || existing.organizationId || orgId || 'default-org';
    const normalizedPhone = dto.phoneNumber !== undefined ? this.normalizePhone(dto.phoneNumber) : existing.phoneNumber;
    const normalizedWhatsApp =
      dto.whatsappNumber !== undefined ? this.normalizePhone(dto.whatsappNumber) : existing.whatsappNumber;
    const normalizedEmail = dto.email !== undefined ? this.normalizeEmail(dto.email) : existing.email;
    const normalizedAltEmail =
      dto.alternateEmail !== undefined ? this.normalizeEmail(dto.alternateEmail) : existing.alternateEmail;

    const firstName = dto.firstName !== undefined ? dto.firstName : existing.firstName;
    const lastName = dto.lastName !== undefined ? dto.lastName : existing.lastName;
    const fullName =
      dto.fullName !== undefined
        ? dto.fullName
        : `${firstName || ''} ${lastName || ''}`.trim() || existing.fullName;

    const duplicateFlags = await this.detectDuplicates(
      normalizedEmail,
      normalizedPhone,
      normalizedWhatsApp,
      normalizedAltEmail,
      organizationId,
      id,
    );

    Object.assign(existing, {
      ...dto,
      fullName,
      phoneNumber: normalizedPhone,
      whatsappNumber: normalizedWhatsApp,
      email: normalizedEmail,
      alternateEmail: normalizedAltEmail,
      organizationId,
      duplicateFlags,
    });

    return existing.save();
  }

  async delete(id: string, orgId = 'default-org'): Promise<void> {
    const query: FilterQuery<ContactDocument> = Types.ObjectId.isValid(id)
      ? { _id: new Types.ObjectId(id) }
      : { _id: id as any };

    if (orgId && orgId !== 'ALL') {
      query.organizationId = orgId;
    }
    const result = await this.contactModel.findOneAndDelete(query).exec();
    if (!result) {
      throw new NotFoundException(`Contact #${id} not found in this organization`);
    }
  }

  async deleteMany(ids: string[], orgId = 'default-org'): Promise<{ deletedCount: number }> {
    const mappedIds = ids.map((id) => (Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : (id as any)));
    const query: FilterQuery<ContactDocument> = { _id: { $in: mappedIds } };

    if (orgId && orgId !== 'ALL') {
      query.organizationId = orgId;
    }
    const result = await this.contactModel.deleteMany(query).exec();
    return { deletedCount: result.deletedCount || 0 };
  }


  async getStats(orgId = 'default-org'): Promise<{
    totalContacts: number;
    duplicateAlertsCount: number;
    leadSources: string[];
    statuses: Record<string, number>;
  }> {
    const query: FilterQuery<ContactDocument> = orgId && orgId !== 'ALL' ? { organizationId: orgId } : {};

    const [totalContacts, duplicateAlertsCount, leadSources, statusCounts] = await Promise.all([
      this.contactModel.countDocuments(query).exec(),
      this.contactModel.countDocuments({ ...query, 'duplicateFlags.0': { $exists: true } }).exec(),
      this.contactModel.distinct('leadSource', query).exec(),
      this.contactModel.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statuses: Record<string, number> = { lead: 0, prospect: 0, customer: 0, active: 0, inactive: 0 };
    for (const item of statusCounts) {
      if (item._id) statuses[item._id] = item.count;
    }

    return {
      totalContacts,
      duplicateAlertsCount,
      leadSources: leadSources.filter(Boolean),
      statuses,
    };
  }

  /**
   * Generates standard RFC 4180 CSV export of filtered contacts for the organization
   */
  async exportCsv(filterDto: FilterContactsDto, orgId = 'default-org'): Promise<string> {
    const activeOrgId = filterDto.organizationId || orgId || 'default-org';
    const query: FilterQuery<ContactDocument> = { organizationId: activeOrgId };

    if (filterDto.search && filterDto.search.trim()) {
      const regex = new RegExp(filterDto.search.trim(), 'i');
      query.$or = [
        { fullName: regex },
        { email: regex },
        { phoneNumber: regex },
        { whatsappNumber: regex },
        { company: regex },
        { department: regex },
      ];
    }
    if (filterDto.status && filterDto.status !== 'all') query.status = filterDto.status.trim();
    if (filterDto.leadSource && filterDto.leadSource !== 'all') query.leadSource = new RegExp(filterDto.leadSource.trim(), 'i');
    if (filterDto.city) query.city = new RegExp(filterDto.city.trim(), 'i');
    if (filterDto.country) query.country = new RegExp(filterDto.country.trim(), 'i');

    const contacts = await this.contactModel.find(query).sort({ createdAt: -1 }).limit(5000).exec();

    const headers = [
      'ID',
      'First Name',
      'Last Name',
      'Full Name',
      'Phone Number',
      'WhatsApp Number',
      'Email Address',
      'Alternate Email',
      'Company',
      'Department',
      'Designation',
      'Status',
      'Lead Source',
      'Owner',
      'City',
      'Country',
      'Website',
      'Tags',
      'Notes',
      'Created At',
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = contacts.map((c) => [
      escapeCsv(c._id),
      escapeCsv(c.firstName),
      escapeCsv(c.lastName),
      escapeCsv(c.fullName),
      escapeCsv(c.phoneNumber),
      escapeCsv(c.whatsappNumber),
      escapeCsv(c.email),
      escapeCsv(c.alternateEmail),
      escapeCsv(c.company),
      escapeCsv(c.department),
      escapeCsv(c.designation),
      escapeCsv(c.status || 'lead'),
      escapeCsv(c.leadSource),
      escapeCsv(c.owner),
      escapeCsv(c.city),
      escapeCsv(c.country),
      escapeCsv(c.website),
      escapeCsv((c.tags || []).join('; ')),
      escapeCsv(c.notes),
      escapeCsv((c as any).createdAt ? new Date((c as any).createdAt).toISOString() : ''),
    ]);

    // UTF-8 BOM + CSV Lines
    return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }
}
