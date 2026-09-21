import { Module } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { ContactsModule } from '../contacts/contacts.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [ContactsModule, CustomFieldsModule],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
