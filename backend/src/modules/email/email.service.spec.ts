import { EmailService } from './email.service';

describe('EmailService Account Limits & Eligibility', () => {
  let service: EmailService;
  let mockAccountModel: any;
  let mockConversationModel: any;
  let mockMessageModel: any;
  let mockContactModel: any;
  let mockCryptoService: any;
  let mockSmtpFactory: any;
  let mockImapSyncService: any;

  beforeEach(() => {
    mockAccountModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
    };
    mockConversationModel = {
      findOne: jest.fn(),
    };
    mockMessageModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };
    mockContactModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
    };
    mockCryptoService = {
      encrypt: jest.fn((s) => `enc_${s}`),
      decrypt: jest.fn((s) => s.replace('enc_', '')),
    };
    mockSmtpFactory = {
      createTransporter: jest.fn(),
      verifyConnection: jest.fn(),
    };
    mockImapSyncService = {
      verifyImapConnection: jest.fn(),
      fetchRecentEmails: jest.fn(),
    };

    service = new EmailService(
      mockAccountModel,
      mockConversationModel,
      mockMessageModel,
      mockContactModel,
      mockCryptoService,
      mockSmtpFactory,
      mockImapSyncService,
    );
  });

  it('should allow sending when account is active and within limits', () => {
    const mockAccount: any = {
      status: 'active',
      dailyLimit: 500,
      hourlyLimit: 50,
      sentTodayCount: 10,
      sentThisHourCount: 5,
      lastSentAt: new Date(),
    };

    const result = service.isAccountEligible(mockAccount);
    expect(result.eligible).toBe(true);
  });

  it('should block sending when daily limit is reached', () => {
    const mockAccount: any = {
      status: 'active',
      dailyLimit: 500,
      hourlyLimit: 50,
      sentTodayCount: 500,
      sentThisHourCount: 5,
      lastSentAt: new Date(),
    };

    const result = service.isAccountEligible(mockAccount);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Daily sending limit');
  });

  it('should block sending when hourly limit is reached', () => {
    const mockAccount: any = {
      status: 'active',
      dailyLimit: 500,
      hourlyLimit: 50,
      sentTodayCount: 40,
      sentThisHourCount: 50,
      lastSentAt: new Date(),
    };

    const result = service.isAccountEligible(mockAccount);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Hourly sending limit');
  });

  it('should test connection and mark SMTP connected while detecting disabled IMAP', async () => {
    const mockAccountDoc: any = {
      _id: 'acc_123',
      emailAddress: 'info@thedigitalconnect.in',
      encryptedPassword: 'enc_secret',
      smtpHost: 'smtp.zoho.in',
      smtpPort: 465,
      smtpSecure: true,
      imapHost: 'imap.zoho.in',
      imapPort: 993,
      imapSecure: true,
      status: 'invalid_credentials',
      smtpStatus: 'invalid_credentials',
      imapStatus: 'not_configured',
      save: jest.fn().mockResolvedValue(true),
    };

    mockAccountModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockAccountDoc),
    });

    mockSmtpFactory.verifyConnection.mockResolvedValue({
      success: true,
      category: 'Connected',
      message: 'SMTP connection established successfully with smtp.zoho.in:465',
    });

    mockImapSyncService.verifyImapConnection.mockResolvedValue({
      success: false,
      category: 'disabled_by_provider',
      error: 'IMAP is disabled for this Zoho account. Enable IMAP in Zoho Mail settings or contact your administrator.',
    });

    const result = await service.testConnection('acc_123');
    expect(result.success).toBe(true);
    expect(result.smtpSuccess).toBe(true);
    expect(result.smtpStatus).toBe('connected');
    expect(result.imapSuccess).toBe(false);
    expect(result.imapStatus).toBe('disabled_by_provider');
    expect(mockAccountDoc.status).toBe('active'); // Outgoing email sending enabled
    expect(mockAccountDoc.save).toHaveBeenCalled();
  });

  it('should handle IMAP sync failure gracefully when IMAP is disabled by provider', async () => {
    const mockAccountDoc: any = {
      _id: 'acc_123',
      emailAddress: 'info@thedigitalconnect.in',
      encryptedPassword: 'enc_secret',
      imapHost: 'imap.zoho.in',
      imapPort: 993,
      imapSecure: true,
      imapStatus: 'connected',
      save: jest.fn().mockResolvedValue(true),
    };

    mockAccountModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockAccountDoc),
    });

    mockImapSyncService.fetchRecentEmails.mockRejectedValue(
      new Error('You are yet to enable IMAP for your account. Please contact your administrator (Failure)'),
    );

    const syncRes = await service.syncInbox('acc_123');
    expect(syncRes.success).toBe(false);
    expect(syncRes.status).toBe('disabled_by_provider');
    expect(syncRes.message).toContain('IMAP is disabled for this Zoho account');
    expect(mockAccountDoc.imapStatus).toBe('disabled_by_provider');
  });
});
