import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const isLocalhost =
  isBrowser &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// In browser production, connect directly to backend URL (https://backendcrm.imprenta.in/api)
// or use process.env.NEXT_PUBLIC_API_URL to bypass Vercel proxy / 502 rewrite errors.
// In local development, connect to local backend (http://localhost:4000/api).
export const API_BASE = isBrowser
  ? (isLocalhost ? 'http://localhost:4000/api' : (process.env.NEXT_PUBLIC_API_URL || 'https://backendcrm.imprenta.in/api'))
  : (process.env.NEXT_PUBLIC_API_URL || 'https://backendcrm.imprenta.in/api');

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Automatically attach authentication credentials from localStorage if present
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('jwt_token') || localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const apiKey = localStorage.getItem('api_key') || localStorage.getItem('x-api-key');
    if (apiKey && !config.headers['x-api-key']) {
      config.headers['x-api-key'] = apiKey;
    }
    const orgId = localStorage.getItem('organization_id') || localStorage.getItem('x-organization-id');
    if (orgId && !config.headers['x-organization-id']) {
      config.headers['x-organization-id'] = orgId;
    }
  }
  return config;
});

// Automatic 401 handling & safe error extraction
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        if (window.location.pathname !== '/login') {
          const currentPath = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

// Response error handler helper
export function extractErrorMessage(err: any): string {
  if (err.response?.status === 502) {
    return 'The server proxy encountered a 502 Bad Gateway. Connecting directly to the backend...';
  }
  if (err.response?.status === 404 && err.config?.url?.includes('/auth/login')) {
    return 'Backend authentication service is deploying. Please allow a moment and try again.';
  }
  if (err.response?.status === 429) {
    const retryAfter = err.response?.headers?.['retry-after'];
    return retryAfter
      ? `Too many requests. Please wait ${retryAfter} seconds and try again.`
      : 'Too many requests. Please slow down and try again in a moment.';
  }
  if (err.response?.status === 503) {
    return 'Database or backend service is temporarily unavailable. Please retry in a moment.';
  }
  if (err.response?.data?.message) {
    const msg = err.response.data.message;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
  return err.message || 'An unexpected error occurred';
}

// Auth API
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  getMe: () => api.get('/auth/me').then((r) => r.data),
};

// Authentication & Token support
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  } else {
    delete api.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('token');
    }
  }
}

export function setApiKey(apiKey: string | null) {
  if (apiKey) {
    api.defaults.headers.common['x-api-key'] = apiKey;
    if (typeof window !== 'undefined') {
      localStorage.setItem('api_key', apiKey);
    }
  } else {
    delete api.defaults.headers.common['x-api-key'];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('api_key');
      localStorage.removeItem('x-api-key');
    }
  }
}

// Multi-tenant organization support
let currentOrganizationId = 'default-org';
export function setTenantOrganizationId(orgId: string) {
  currentOrganizationId = orgId || 'default-org';
  api.defaults.headers.common['x-organization-id'] = currentOrganizationId;
  if (typeof window !== 'undefined') {
    localStorage.setItem('organization_id', currentOrganizationId);
  }
}

// Contacts API
export const contactsApi = {
  getStats: (orgId?: string) =>
    api.get('/contacts/stats', { headers: { 'x-organization-id': orgId || currentOrganizationId } }).then((r) => r.data),
  getAll: (params?: any) =>
    api.get('/contacts', { params, headers: { 'x-organization-id': params?.organizationId || currentOrganizationId } }).then((r) => r.data),
  getById: (id: string, orgId?: string) =>
    api.get(`/contacts/${id}`, { headers: { 'x-organization-id': orgId || currentOrganizationId } }).then((r) => r.data),
  create: (data: any) =>
    api.post('/contacts', data, { headers: { 'x-organization-id': data?.organizationId || currentOrganizationId } }).then((r) => r.data),
  update: (id: string, data: any) =>
    api.put(`/contacts/${id}`, data, { headers: { 'x-organization-id': data?.organizationId || currentOrganizationId } }).then((r) => r.data),
  delete: (id: string, orgId?: string) =>
    api.delete(`/contacts/${id}`, { headers: { 'x-organization-id': orgId || currentOrganizationId } }).then((r) => r.data),
  deleteBulk: (ids: string[], orgId?: string) =>
    api.delete('/contacts/bulk', { data: { ids }, headers: { 'x-organization-id': orgId || currentOrganizationId } }).then((r) => r.data),
  exportCsv: async (params?: any) => {
    const res = await api.get('/contacts/export', {
      params,
      responseType: 'blob',
      headers: { 'x-organization-id': params?.organizationId || currentOrganizationId },
    });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  },
};


// Custom Fields API
export const customFieldsApi = {
  getAll: () => api.get('/custom-fields').then((r) => r.data),
  create: (data: any) => api.post('/custom-fields', data).then((r) => r.data),
  delete: (id: string) => api.delete(`/custom-fields/${id}`).then((r) => r.data),
};

// Imports API
export const importsApi = {
  upload: (formData: FormData) =>
    api.post('/imports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  preview: (data: any) => api.post('/imports/preview', data).then((r) => r.data),
  execute: (data: any) => api.post('/imports/execute', data).then((r) => r.data),
  getHistory: () => api.get('/imports/history').then((r) => r.data),
  getJob: (id: string) => api.get(`/imports/history/${id}`).then((r) => r.data),
  getMappings: () => api.get('/imports/mappings').then((r) => r.data),
  saveMapping: (name: string, mapping: Record<string, string>) =>
    api.post('/imports/mappings', { name, mapping }).then((r) => r.data),
  deleteMapping: (id: string) => api.delete(`/imports/mappings/${id}`).then((r) => r.data),
};

// WhatsApp API
export const whatsappApi = {
  getConnections: () => api.get('/whatsapp/connections').then((r) => r.data),
  getConnectionStatus: (id: string) => api.get(`/whatsapp/connections/${id}/status`).then((r) => r.data),
  createConnection: (data: any) => api.post('/whatsapp/connections', data).then((r) => r.data),
  testConnection: (id: string) => api.post(`/whatsapp/connections/${id}/test`).then((r) => r.data),
  confirmPair: (id: string, phoneNumber?: string) => api.post(`/whatsapp/connections/${id}/confirm-pair`, { phoneNumber }).then((r) => r.data),
  syncTemplates: (id: string) => api.post(`/whatsapp/connections/${id}/sync-templates`).then((r) => r.data),
  deleteConnection: (id: string) => api.delete(`/whatsapp/connections/${id}`).then((r) => r.data),
  getTemplates: (connectionId?: string) => api.get('/whatsapp/templates', { params: { connectionId } }).then((r) => r.data),
  sendMessage: (data: any) => api.post('/whatsapp/send', data).then((r) => r.data),
};

// Email API
export const emailApi = {
  getAccounts: () => api.get('/email/accounts').then((r) => r.data),
  getAccountById: (id: string) => api.get(`/email/accounts/${id}`).then((r) => r.data),
  createAccount: (data: any) => api.post('/email/accounts', data).then((r) => r.data),
  updateAccount: (id: string, data: any) => api.put(`/email/accounts/${id}`, data).then((r) => r.data),
  deleteAccount: (id: string) => api.delete(`/email/accounts/${id}`).then((r) => r.data),
  testConnection: (id: string) => api.post(`/email/accounts/${id}/test`).then((r) => r.data),
  syncInbox: (id: string) => api.post(`/email/accounts/${id}/sync`).then((r) => r.data),
  sendEmail: (data: any) => api.post('/email/accounts/send', data).then((r) => r.data),
};

// Inboxes API
export const inboxApi = {
  getWhatsAppConversations: (connectionId?: string, search?: string, filter?: string) =>
    api.get('/inbox/whatsapp/conversations', { params: { connectionId, search, filter } }).then((r) => r.data),
  getWhatsAppMessages: (id: string, limit?: number, before?: string) =>
    api.get(`/inbox/whatsapp/conversations/${id}/messages`, { params: { limit, before } }).then((r) => r.data),
  replyWhatsApp: (id: string, payload: string | {
    text?: string;
    caption?: string;
    messageType?: string;
    mediaBase64?: string;
    mimetype?: string;
    filename?: string;
    fileSize?: number;
    duration?: number;
    latitude?: number;
    longitude?: number;
    contactData?: { displayName: string; vcard: string };
    quotedMessageId?: string;
    reactionEmoji?: string;
  }) => {
    const body = typeof payload === 'string' ? { text: payload } : payload;
    return api.post(`/inbox/whatsapp/conversations/${id}/reply`, body).then((r) => r.data);
  },
  reactWhatsApp: (id: string, emoji: string, messageId: string, fromMe = false) =>
    api.post(`/inbox/whatsapp/conversations/${id}/react`, { emoji, messageId, fromMe }).then((r) => r.data),
  startWhatsAppConversation: (data: { connectionId: string; recipientPhoneNumber: string; customerName?: string; messageBody?: string }) =>
    api.post('/inbox/whatsapp/conversations/start', data).then((r) => r.data),
  updateWhatsAppConversation: (id: string, data: { isPinned?: boolean; isMuted?: boolean; isArchived?: boolean; unreadCount?: number }) =>
    api.patch(`/inbox/whatsapp/conversations/${id}`, data).then((r) => r.data),
  clearWhatsAppMessages: (id: string) =>
    api.delete(`/inbox/whatsapp/conversations/${id}/messages`).then((r) => r.data),
  retryWhatsAppMessage: (id: string) =>
    api.post(`/inbox/whatsapp/messages/${id}/retry`).then((r) => r.data),

  getEmailConversations: (paramsOrAccountId?: any, search?: string) => {
    let params: any = {};
    if (typeof paramsOrAccountId === 'string') {
      params = { accountId: paramsOrAccountId, search };
    } else if (paramsOrAccountId && typeof paramsOrAccountId === 'object') {
      params = paramsOrAccountId;
    }
    return api.get('/inbox/email/conversations', { params }).then((r) => r.data);
  },
  getEmailCounts: (accountId?: string) =>
    api.get('/inbox/email/counts', { params: { accountId } }).then((r) => r.data),
  getEmailMessages: (id: string) => api.get(`/inbox/email/conversations/${id}/messages`).then((r) => r.data),
  updateEmailConversation: (id: string, data: any) =>
    api.patch(`/inbox/email/conversations/${id}`, data).then((r) => r.data),
  bulkEmailAction: (data: { ids: string[]; action: string; folder?: string; label?: string; isImportant?: boolean }) =>
    api.post('/inbox/email/conversations/bulk', data).then((r) => r.data),
  deleteEmailConversation: (id: string) =>
    api.delete(`/inbox/email/conversations/${id}`).then((r) => r.data),
  saveEmailDraft: (data: any) =>
    api.post('/inbox/email/drafts', data).then((r) => r.data),
  replyEmail: (
    id: string,
    arg1: any,
    arg2?: string,
    cc?: string[],
    bcc?: string[],
    attachments?: any[],
  ) => {
    const payload = typeof arg1 === 'string'
      ? { subject: arg1, bodyHtml: arg2 || '', cc, bcc, attachments }
      : {
          subject: arg1?.subject || '',
          bodyHtml: arg1?.bodyHtml || arg1?.body || '',
          cc: arg1?.cc || cc,
          bcc: arg1?.bcc || bcc,
          attachments: arg1?.attachments || attachments,
        };
    return api.post(`/inbox/email/conversations/${id}/reply`, payload).then((r) => r.data);
  },
};

// Campaigns API
export const campaignsApi = {
  getAll: (params?: any) => api.get('/campaigns', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/campaigns/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/campaigns', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/campaigns/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/campaigns/${id}`).then((r) => r.data),
  start: (id: string) => api.post(`/campaigns/${id}/launch`).then((r) => r.data),
  launch: (id: string) => api.post(`/campaigns/${id}/launch`).then((r) => r.data),
  pause: (id: string) => api.post(`/campaigns/${id}/pause`).then((r) => r.data),
  resume: (id: string) => api.post(`/campaigns/${id}/resume`).then((r) => r.data),
  cancel: (id: string) => api.post(`/campaigns/${id}/cancel`).then((r) => r.data),
  retry: (id: string) => api.post(`/campaigns/${id}/retry`).then((r) => r.data),
  getRecipients: (id: string, page?: number, limit?: number) =>
    api.get(`/campaigns/${id}/recipients`, { params: { page, limit } }).then((r) => r.data),
  getStats: (id: string) => api.get(`/campaigns/${id}/stats`).then((r) => r.data),
  getLogs: (id: string, params?: any) => api.get(`/campaigns/${id}/logs`, { params }).then((r) => r.data),
};

// CRM API
export const crmApi = {
  getLeads: (stage?: string, search?: string) =>
    api.get('/crm/leads', { params: { stage, search } }).then((r) => r.data),
  getPipelineSummary: () => api.get('/crm/pipeline').then((r) => r.data),
  createLead: (data: any) => api.post('/crm/leads', data).then((r) => r.data),
  updateLead: (id: string, data: any) => api.patch(`/crm/leads/${id}`, data).then((r) => r.data),
  deleteLead: (id: string) => api.delete(`/crm/leads/${id}`).then((r) => r.data),

  getActivities: (contactId?: string, leadId?: string, limit?: number) =>
    api.get('/crm/activities', { params: { contactId, leadId, limit } }).then((r) => r.data),
  createActivity: (data: any) => api.post('/crm/activities', data).then((r) => r.data),

  getFollowUps: (status?: string) =>
    api.get('/crm/follow-ups', { params: { status } }).then((r) => r.data),
  createFollowUp: (data: any) => api.post('/crm/follow-ups', data).then((r) => r.data),
  updateFollowUp: (id: string, data: any) => api.patch(`/crm/follow-ups/${id}`, data).then((r) => r.data),
  deleteFollowUp: (id: string) => api.delete(`/crm/follow-ups/${id}`).then((r) => r.data),

  getLeadSources: () => api.get('/crm/sources').then((r) => r.data),
};

// Settings & Theme API
export const settingsApi = {
  getSettings: () => api.get('/settings').then((r) => r.data),
  updateSettings: (data: any) => api.patch('/settings', data).then((r) => r.data),
  getTheme: () => api.get('/settings/theme').then((r) => r.data),
  updateTheme: (data: any) => api.patch('/settings/theme', data).then((r) => r.data),
  resetTheme: () => api.post('/settings/theme/reset').then((r) => r.data),
};
