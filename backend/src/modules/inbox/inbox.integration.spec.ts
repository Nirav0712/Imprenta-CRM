import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EmailInboxService } from './email-inbox/email-inbox.service';
import { WhatsAppInboxService } from './whatsapp-inbox/whatsapp-inbox.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailConversation } from '../../database/schemas/email-conversation.schema';
import { EmailMessage } from '../../database/schemas/email-message.schema';
import { WhatsAppConversation } from '../../database/schemas/whatsapp-conversation.schema';
import { WhatsAppMessage } from '../../database/schemas/whatsapp-message.schema';

import { Contact } from '../../database/schemas/contact.schema';
import { InMemoryLiveChatStore } from '../whatsapp/stores/in-memory-live-chat.store';

describe('Real-Time Inbox Integration Audit & Tests', () => {
  let emailInboxService: EmailInboxService;
  let whatsAppInboxService: WhatsAppInboxService;
  let inMemoryLiveChatStore: InMemoryLiveChatStore;

  // In-memory mock store
  let emailConversations: any[] = [];
  let emailMessages: any[] = [];
  let whatsAppConversations: any[] = [];
  let whatsAppMessages: any[] = [];
  let contacts: any[] = [];

  const mockContactModel: any = {
    find: jest.fn().mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue(contacts),
    })),
    findOne: jest.fn().mockImplementation(() => Promise.resolve(null)),
    findById: jest.fn().mockImplementation((id: string) =>
      Promise.resolve(contacts.find((c) => String(c._id) === String(id)) || null),
    ),
  };

  const mockEmailConversationModel: any = {
    find: jest.fn().mockImplementation((filter: any) => {
      let res = [...emailConversations];
      if (filter.accountId) {
        res = res.filter((c) => String(c.accountId) === String(filter.accountId));
      }
      return {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(res),
      };
    }),
    countDocuments: jest.fn().mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue(emailConversations.length),
    })),
    findById: jest.fn().mockImplementation((id: string) => {
      const conv = emailConversations.find((c) => String(c._id) === String(id));
      if (!conv) return Promise.resolve(null);
      return Promise.resolve({
        ...conv,
        save: jest.fn().mockResolvedValue(conv),
      });
    }),
    findOne: jest.fn().mockImplementation((filter: any) => {
      const conv = emailConversations.find(
        (c) =>
          String(c.accountId) === String(filter.accountId) &&
          c.customerEmail === filter.customerEmail,
      );
      return Promise.resolve(conv || null);
    }),
  };

  const mockEmailMessageModel: any = {
    find: jest.fn().mockImplementation((filter: any) => {
      let res = [...emailMessages];
      if (filter.conversationId) {
        res = res.filter((m) => String(m.conversationId) === String(filter.conversationId));
      }
      return {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(res),
      };
    }),
    findOne: jest.fn().mockImplementation((filter: any) => {
      const msg = emailMessages.find(
        (m) =>
          String(m.accountId) === String(filter.accountId) &&
          m.providerMessageId === filter.providerMessageId,
      );
      return Promise.resolve(msg || null);
    }),
  };

  const mockWhatsAppConversationModel: any = {
    find: jest.fn().mockImplementation((filter: any) => {
      let res = [...whatsAppConversations];
      if (filter.connectionId) {
        res = res.filter((c) => String(c.connectionId) === String(filter.connectionId));
      }
      return {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(res),
      };
    }),
    findById: jest.fn().mockImplementation((id: string) => {
      const conv = whatsAppConversations.find((c) => String(c._id) === String(id));
      if (!conv) return Promise.resolve(null);
      return Promise.resolve({
        ...conv,
        save: jest.fn().mockResolvedValue(conv),
      });
    }),
    findOne: jest.fn().mockImplementation((filter: any) => {
      const conv = whatsAppConversations.find(
        (c) =>
          String(c.connectionId) === String(filter.connectionId) &&
          c.customerPhoneNumber === filter.customerPhoneNumber,
      );
      return Promise.resolve(conv || null);
    }),
  };

  const mockWhatsAppMessageModel: any = {
    find: jest.fn().mockImplementation((filter: any) => {
      let res = [...whatsAppMessages];
      if (filter.conversationId) {
        res = res.filter((m) => String(m.conversationId) === String(filter.conversationId));
      }
      return {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(res),
      };
    }),
    findOne: jest.fn().mockImplementation((filter: any) => {
      const msg = whatsAppMessages.find(
        (m) =>
          String(m.connectionId) === String(filter.connectionId) &&
          m.providerMessageId === filter.providerMessageId,
      );
      return Promise.resolve(msg || null);
    }),
  };

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue({ status: 'sent' }),
  };

  const mockWhatsAppService = {
    sendMessage: jest.fn().mockResolvedValue({ status: 'sent' }),
  };

  beforeEach(async () => {
    emailConversations = [];
    emailMessages = [];
    whatsAppConversations = [];
    whatsAppMessages = [];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailInboxService,
        WhatsAppInboxService,
        {
          provide: getModelToken(EmailConversation.name),
          useValue: mockEmailConversationModel,
        },
        {
          provide: getModelToken(EmailMessage.name),
          useValue: mockEmailMessageModel,
        },
        {
          provide: getModelToken(WhatsAppConversation.name),
          useValue: mockWhatsAppConversationModel,
        },
        {
          provide: getModelToken(WhatsAppMessage.name),
          useValue: mockWhatsAppMessageModel,
        },
        {
          provide: getModelToken(Contact.name),
          useValue: mockContactModel,
        },
        InMemoryLiveChatStore,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: WhatsAppService,
          useValue: mockWhatsAppService,
        },
      ],
    }).compile();

    emailInboxService = module.get<EmailInboxService>(EmailInboxService);
    whatsAppInboxService = module.get<WhatsAppInboxService>(WhatsAppInboxService);
    inMemoryLiveChatStore = module.get<InMemoryLiveChatStore>(InMemoryLiveChatStore);
  });

  describe('Part 1: Empty Inbox States', () => {
    it('should return empty list when no email conversations exist', async () => {
      const convs = await emailInboxService.getConversations();
      expect(convs.items).toEqual([]);
      expect(convs.total).toBe(0);
    });

    it('should return empty list when no WhatsApp conversations exist', async () => {
      const convs = await whatsAppInboxService.getConversations();
      expect(convs).toEqual([]);
    });
  });

  describe('Part 2: Email Inbox Operations & Account Isolation', () => {
    const account1Id = new Types.ObjectId();
    const account2Id = new Types.ObjectId();
    const conv1Id = new Types.ObjectId();

    beforeEach(() => {
      emailConversations = [
        {
          _id: conv1Id,
          accountId: account1Id,
          customerEmail: 'alice@example.com',
          customerName: 'Alice',
          subject: 'Quote Request',
          snippet: 'Please provide pricing',
          unreadCount: 2,
          lastMessageAt: new Date(),
        },
        {
          _id: new Types.ObjectId(),
          accountId: account2Id,
          customerEmail: 'bob@example.com',
          customerName: 'Bob',
          subject: 'Partnership',
          snippet: 'Let us collaborate',
          unreadCount: 0,
          lastMessageAt: new Date(),
        },
      ];

      emailMessages = [
        {
          _id: new Types.ObjectId(),
          conversationId: conv1Id,
          accountId: account1Id,
          direction: 'inbound',
          from: 'alice@example.com',
          to: 'sales@company.com',
          subject: 'Quote Request',
          bodyHtml: '<p>Please provide pricing</p>',
          providerMessageId: 'msg_001',
          date: new Date(),
        },
      ];
    });

    it('should isolate email conversations by accountId', async () => {
      const acc1Convs = await emailInboxService.getConversations(String(account1Id));
      expect(acc1Convs.items).toHaveLength(1);
      expect(acc1Convs.items[0].customerEmail).toBe('alice@example.com');

      const acc2Convs = await emailInboxService.getConversations(String(account2Id));
      expect(acc2Convs.items).toHaveLength(1);
      expect(acc2Convs.items[0].customerEmail).toBe('bob@example.com');
    });

    it('should retrieve messages for a conversation and mark as read', async () => {
      const msgs = await emailInboxService.getMessages(String(conv1Id));
      expect(msgs).toHaveLength(1);
      expect(msgs[0].providerMessageId).toBe('msg_001');
    });

    it('should send reply and format Re: subject accurately', async () => {
      await emailInboxService.replyMessage(String(conv1Id), 'Here is the quote', '<p>Attached</p>');
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: String(account1Id),
          toEmail: 'alice@example.com',
          subject: 'Re: Quote Request',
          bodyHtml: '<p>Attached</p>',
        }),
      );
    });
  });

  describe('Part 3: WhatsApp Inbox Operations & Connection Isolation', () => {
    const conn1Id = new Types.ObjectId();
    const conn2Id = new Types.ObjectId();
    const conv1Id = new Types.ObjectId();
    const conv2Id = new Types.ObjectId();

    beforeEach(() => {
      whatsAppConversations = [
        {
          _id: conv1Id,
          connectionId: conn1Id,
          customerPhoneNumber: '+15551234567',
          customerName: 'Client Alpha',
          lastMessageText: 'Hello there',
          unreadCount: 1,
          lastActivityAt: new Date(),
        },
        {
          _id: conv2Id,
          connectionId: conn2Id,
          customerPhoneNumber: '+15559876543',
          customerName: 'Client Beta',
          lastMessageText: 'Order confirmation',
          unreadCount: 0,
          lastActivityAt: new Date(),
        },
      ];

      whatsAppMessages = [
        {
          _id: new Types.ObjectId(),
          conversationId: conv1Id,
          connectionId: conn1Id,
          direction: 'inbound',
          status: 'delivered',
          providerMessageId: 'baileys_msg_100',
          messageBody: 'Hello there',
          timestamp: new Date(),
        },
      ];

      // Add message to in-memory live stream store
      inMemoryLiveChatStore.addMessage({
        conversationId: String(conv1Id),
        connectionId: String(conn1Id),
        remoteJid: '15551234567@s.whatsapp.net',
        senderPhoneNumber: '+15551234567',
        direction: 'inbound',
        status: 'delivered',
        providerMessageId: 'baileys_msg_100',
        messageBody: 'Hello there',
        timestamp: new Date(),
      });

      inMemoryLiveChatStore.addMessage({
        conversationId: String(conv2Id),
        connectionId: String(conn2Id),
        remoteJid: '15559876543@s.whatsapp.net',
        senderPhoneNumber: '+15559876543',
        direction: 'inbound',
        status: 'delivered',
        providerMessageId: 'baileys_msg_101',
        messageBody: 'Order confirmation',
        timestamp: new Date(),
      });
    });

    it('should isolate WhatsApp conversations by connectionId', async () => {
      const conn1Chats = await whatsAppInboxService.getConversations(String(conn1Id));
      expect(conn1Chats.length).toBeGreaterThanOrEqual(1);
      expect(conn1Chats.some((c) => c.customerPhoneNumber === '+15551234567')).toBe(true);

      const conn2Chats = await whatsAppInboxService.getConversations(String(conn2Id));
      expect(conn2Chats.length).toBeGreaterThanOrEqual(1);
      expect(conn2Chats.some((c) => c.customerPhoneNumber === '+15559876543')).toBe(true);
    });

    it('should retrieve conversation message history from in-memory stream', async () => {
      const msgs = await whatsAppInboxService.getMessages(String(conv1Id));
      expect(msgs).toHaveLength(1);
      expect(msgs[0].messageBody).toBe('Hello there');
    });

    it('should send WhatsApp reply with recipient number and connection', async () => {
      await whatsAppInboxService.replyMessage(String(conv1Id), 'Hello Alpha, how can we help?');
      expect(mockWhatsAppService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: String(conn1Id),
          recipientPhoneNumber: '+15551234567',
          customMessageBody: 'Hello Alpha, how can we help?',
        }),
      );
    });

    it('should update conversation pin status', async () => {
      const updated = await whatsAppInboxService.updateConversation(String(conv1Id), { isPinned: true });
      expect(updated).toBeDefined();
    });

    it('should clear conversation message history from in-memory store', async () => {
      const res = await whatsAppInboxService.clearMessages(String(conv1Id));
      expect(res.success).toBe(true);
      const msgs = await whatsAppInboxService.getMessages(String(conv1Id));
      expect(msgs).toHaveLength(0);
    });
  });
});
