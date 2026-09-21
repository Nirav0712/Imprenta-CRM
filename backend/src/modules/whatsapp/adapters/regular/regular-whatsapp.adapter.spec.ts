import { RegularWhatsAppAdapter } from './regular-whatsapp.adapter';

describe('RegularWhatsAppAdapter', () => {
  let adapter: RegularWhatsAppAdapter;
  let mockSocket: any;

  beforeEach(() => {
    adapter = new RegularWhatsAppAdapter();
    mockSocket = {
      ev: {
        on: jest.fn((event: string, callback: any) => {
          if (event === 'connection.update') {
            setTimeout(() => callback({ qr: '2@mock_baileys_qr_string_from_socket_event_123456789' }), 10);
          }
        }),
        removeAllListeners: jest.fn(),
      },
      end: jest.fn(),
      logout: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue({ key: { id: 'mock_msg_id' } }),
      user: { id: '15551234567:1@s.whatsapp.net' },
    };

    (adapter as any).getBaileys = jest.fn().mockResolvedValue({
      default: jest.fn().mockReturnValue(mockSocket),
      useMultiFileAuthState: jest.fn().mockResolvedValue({
        state: { creds: {}, keys: {} },
        saveCreds: jest.fn(),
      }),
      fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 3000, 1015901307] }),
      makeCacheableSignalKeyStore: jest.fn().mockReturnValue({}),
      DisconnectReason: { loggedOut: 401, restartRequired: 515, timedOut: 408 },
    });
  });

  afterEach(async () => {
    await adapter.onModuleDestroy();
  });

  it('should initialize, wait for QR event, and return qr_ready session state', async () => {
    const session = await adapter.initializeSession('test_conn_1');
    expect(session.connectionId).toBe('test_conn_1');
    expect(session.status).toBe('qr_ready');
    expect(session.qrCodeDataUrl).toBeDefined();
    expect(session.qrCodeDataUrl).toContain('data:image/png;base64');
  });

  it('should return session state for existing session', async () => {
    await adapter.initializeSession('test_conn_2');
    const session = adapter.getSession('test_conn_2');
    expect(session).toBeDefined();
    expect(session?.connectionId).toBe('test_conn_2');
  });

  it('should clean up socket on disconnect', async () => {
    await adapter.initializeSession('test_conn_3');
    await adapter.disconnect('test_conn_3');
    const session = adapter.getSession('test_conn_3');
    expect(session?.status).toBe('disconnected');
    expect(mockSocket.logout).toHaveBeenCalled();
  });

  it('should fail sending if session is not connected', async () => {
    const result = await adapter.sendMessage('test_conn_4', '+1234567890', 'Hello');
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('not active or connected');
  });
});
