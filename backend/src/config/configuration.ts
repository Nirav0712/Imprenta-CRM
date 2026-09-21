export interface AppConfig {
  port: number;
  mongoUri: string;
  mongoDbName: string;
  encryptionKey: string;
  metaVerifyToken: string;
  defaultSendingDelaySec: number;
  defaultBatchSize: number;
  defaultBatchPauseSec: number;
}

export const configuration = (): AppConfig => ({
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_automation',
  mongoDbName: process.env.MONGODB_DB_NAME || 'automarket',
  encryptionKey: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  metaVerifyToken: process.env.META_VERIFY_TOKEN || 'marketing_auto_meta_verify_token_2026',
  defaultSendingDelaySec: parseInt(process.env.DEFAULT_SENDING_DELAY_SEC || '2', 10),
  defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || '50', 10),
  defaultBatchPauseSec: parseInt(process.env.DEFAULT_BATCH_PAUSE_SEC || '60', 10),
});

