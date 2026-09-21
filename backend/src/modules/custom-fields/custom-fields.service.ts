import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CustomField, CustomFieldDocument } from '../../database/schemas/custom-field.schema';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';

@Injectable()
export class CustomFieldsService {
  constructor(
    @InjectModel(CustomField.name)
    private readonly customFieldModel: Model<CustomFieldDocument>,
  ) {}

  async findAll(): Promise<CustomField[]> {
    return this.customFieldModel.find().sort({ createdAt: 1 }).exec();
  }

  async findByKey(key: string): Promise<CustomField | null> {
    return this.customFieldModel.findOne({ key }).exec();
  }

  async create(dto: CreateCustomFieldDto): Promise<CustomField> {
    const existing = await this.findByKey(dto.key);
    if (existing) {
      throw new ConflictException(`Custom field with key '${dto.key}' already exists`);
    }
    const created = new this.customFieldModel(dto);
    return created.save();
  }

  async createIfNotExists(dto: CreateCustomFieldDto): Promise<CustomField> {
    const existing = await this.findByKey(dto.key);
    if (existing) return existing;
    const created = new this.customFieldModel(dto);
    return created.save();
  }

  async delete(id: string): Promise<void> {
    const result = await this.customFieldModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Custom field not found`);
    }
  }
}
