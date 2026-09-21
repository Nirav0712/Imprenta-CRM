import { WhatsAppService } from './whatsapp.service';
import { InMemoryLiveChatStore } from './stores/in-memory-live-chat.store';

describe('WhatsAppService Webhook & Idempotency', () => {
  let service: WhatsAppService;
  let mockConnectionModel: any;
  let mockTemplateModel: any;
  let mockConversationModel: any;
  let mockMessageModel: any;
  let mockContactModel: any;
  let mockCryptoService: any;
  let mockOfficialAdapter: any;
  let mockRegularAdapter: any;
  let inMemoryChatStore: InMemoryLiveChatStore;

  beforeEach(() => {
    mockConnectionModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
    };
    mockTemplateModel = {
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
    };
    mockConversationModel = {
      findOne: jest.fn(),
    };
    mockMessageModel = {
      updateOne: jest.fn(),
    };
    mockContactModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
    };
    mockCryptoService = {
      encrypt: jest.fn((s) => `enc_${s}`),
      decrypt: jest.fn((s) => s.replace('enc_', '')),
      verifyMetaSignature: jest.fn(() => true),
    };
    mockOfficialAdapter = {
      testConnection: jest.fn(),
      fetchTemplates: jest.fn(),
      sendTemplateMessage: jest.fn(),
      sendTextMessage: jest.fn(),
    };
    mockRegularAdapter = {
      initializeSession: jest.fn(),
      confirmPairing: jest.fn(),
      sendMessage: jest.fn(),
    };
    inMemoryChatStore = new InMemoryLiveChatStore();

    service = new WhatsAppService(
      mockConnectionModel,
      mockTemplateModel,
      mockConversationModel,
      mockMessageModel,
      mockContactModel,
      mockCryptoService,
      mockOfficialAdapter,
      mockRegularAdapter,
      inMemoryChatStore,
    );
  });

  it('should verify Meta Webhook challenge correctly', () => {
    const challenge = service.verifyWebhook('subscribe', 'marketing_auto_webhook_verify', 'challenge_token_123');
    expect(challenge).toBe('challenge_token_123');
  });

  it('should reject mismatched webhook token', () => {
    expect(() => {
      service.verifyWebhook('subscribe', 'wrong_token', 'challenge_token_123');
    }).toThrow('Webhook verification token mismatch');
  });

  it('should process webhook status updates and deduplicate idempotent status notifications', async () => {
    const updateSpy = jest.spyOn(inMemoryChatStore, 'updateMessageStatus');
    const rawPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_1',
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI0',
                    status: 'delivered',
                    timestamp: '1690000000',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const firstRun = await service.processWebhookEvent(rawPayload);
    expect(firstRun.processedEvents).toBe(1);
    expect(updateSpy).toHaveBeenCalledWith('', 'wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI0', 'delivered');

    // Second run with duplicate payload should be skipped idempotently
    const secondRun = await service.processWebhookEvent(rawPayload);
    expect(secondRun.processedEvents).toBe(0);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
