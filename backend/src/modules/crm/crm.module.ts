import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { Lead, LeadSchema } from '../../database/schemas/lead.schema';
import { Activity, ActivitySchema } from '../../database/schemas/activity.schema';
import { FollowUp, FollowUpSchema } from '../../database/schemas/follow-up.schema';
import { Contact, ContactSchema } from '../../database/schemas/contact.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: FollowUp.name, schema: FollowUpSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
