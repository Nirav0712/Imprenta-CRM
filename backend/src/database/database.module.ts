import { Module, Global, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Contact, ContactSchema } from './schemas/contact.schema';
import { CustomField, CustomFieldSchema } from './schemas/custom-field.schema';
import { ImportJob, ImportJobSchema } from './schemas/import-job.schema';
import { ImportMapping, ImportMappingSchema } from './schemas/import-mapping.schema';
import { WhatsAppConnection, WhatsAppConnectionSchema } from './schemas/whatsapp-connection.schema';
import { WhatsAppTemplate, WhatsAppTemplateSchema } from './schemas/whatsapp-template.schema';
import { WhatsAppConversation, WhatsAppConversationSchema } from './schemas/whatsapp-conversation.schema';
import { WhatsAppMessage, WhatsAppMessageSchema } from './schemas/whatsapp-message.schema';
import { EmailAccount, EmailAccountSchema } from './schemas/email-account.schema';
import { EmailConversation, EmailConversationSchema } from './schemas/email-conversation.schema';
import { EmailMessage, EmailMessageSchema } from './schemas/email-message.schema';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';
import { CampaignRecipient, CampaignRecipientSchema } from './schemas/campaign-recipient.schema';
import { SendingLog, SendingLogSchema } from './schemas/sending-log.schema';
import { SendingSetting, SendingSettingSchema } from './schemas/sending-setting.schema';
import { ThemeSetting, ThemeSettingSchema } from './schemas/theme-setting.schema';
import { QueueJob, QueueJobSchema } from './schemas/queue-job.schema';
import { Lead, LeadSchema } from './schemas/lead.schema';
import { Activity, ActivitySchema } from './schemas/activity.schema';
import { FollowUp, FollowUpSchema } from './schemas/follow-up.schema';
import { User, UserSchema } from './schemas/user.schema';

const MODELS = [
  { name: Contact.name, schema: ContactSchema },
  { name: CustomField.name, schema: CustomFieldSchema },
  { name: ImportJob.name, schema: ImportJobSchema },
  { name: ImportMapping.name, schema: ImportMappingSchema },
  { name: WhatsAppConnection.name, schema: WhatsAppConnectionSchema },
  { name: WhatsAppTemplate.name, schema: WhatsAppTemplateSchema },
  { name: WhatsAppConversation.name, schema: WhatsAppConversationSchema },
  { name: WhatsAppMessage.name, schema: WhatsAppMessageSchema },
  { name: EmailAccount.name, schema: EmailAccountSchema },
  { name: EmailConversation.name, schema: EmailConversationSchema },
  { name: EmailMessage.name, schema: EmailMessageSchema },
  { name: Campaign.name, schema: CampaignSchema },
  { name: CampaignRecipient.name, schema: CampaignRecipientSchema },
  { name: SendingLog.name, schema: SendingLogSchema },
  { name: SendingSetting.name, schema: SendingSettingSchema },
  { name: ThemeSetting.name, schema: ThemeSettingSchema },
  { name: QueueJob.name, schema: QueueJobSchema },
  { name: Lead.name, schema: LeadSchema },
  { name: Activity.name, schema: ActivitySchema },
  { name: FollowUp.name, schema: FollowUpSchema },
  { name: User.name, schema: UserSchema },
];

const logger = new Logger('DatabaseModule');

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const rawUri = process.env.MONGODB_URI || configService.get<string>('mongoUri') || 'mongodb://127.0.0.1:27017/marketing_automation';
        const dbName = process.env.MONGODB_DB_NAME || configService.get<string>('mongoDbName') || 'automarket';
        const sanitizedUri = rawUri.replace(/\/\/.*@/, '//<auth>@');

        return {
          uri: rawUri,
          dbName,
          autoIndex: process.env.NODE_ENV !== 'production',
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          retryAttempts: 3,
          retryDelay: 2000,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              logger.log(`MongoDB successfully connected to database: "${connection.name || dbName}" (${sanitizedUri})`);
            });
            connection.on('error', (err: any) => {
              logger.error(`MongoDB connection error: ${err?.message || err}`);
            });
            connection.on('disconnected', () => {
              logger.warn(`MongoDB disconnected from database`);
            });
            return connection;
          },
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature(MODELS),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}

