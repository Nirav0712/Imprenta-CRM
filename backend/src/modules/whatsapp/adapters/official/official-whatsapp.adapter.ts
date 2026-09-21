import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface MetaConnectionConfig {
  phoneId: string;
  wabaId: string;
  accessToken: string;
  apiVersion?: string;
}

export interface MetaSendResult {
  providerMessageId: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

export interface MetaTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: any;
  buttons?: any[];
}

export interface MetaTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: MetaTemplateComponent[];
  variables: string[];
}

@Injectable()
export class OfficialWhatsAppAdapter {
  private readonly logger = new Logger(OfficialWhatsAppAdapter.name);

  private getBaseUrl(apiVersion: string = 'v20.0'): string {
    return `https://graph.facebook.com/${apiVersion}`;
  }

  /**
   * Tests the connection with Meta Graph API
   */
  async testConnection(config: MetaConnectionConfig): Promise<{ success: boolean; displayPhoneNumber?: string; verifiedName?: string; error?: string }> {
    try {
      const url = `${this.getBaseUrl(config.apiVersion)}/${config.phoneId}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
        params: {
          fields: 'display_phone_number,verified_name,quality_rating,code_verification_status',
        },
        timeout: 10000,
      });

      return {
        success: true,
        displayPhoneNumber: response.data.display_phone_number,
        verifiedName: response.data.verified_name,
      };
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message;
      this.logger.error(`Official WhatsApp connection test failed: ${msg}`);
      return {
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Fetches official message templates from WABA
   */
  async fetchTemplates(config: MetaConnectionConfig): Promise<MetaTemplate[]> {
    try {
      const url = `${this.getBaseUrl(config.apiVersion)}/${config.wabaId}/message_templates`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
        params: {
          limit: 100,
        },
        timeout: 15000,
      });

      const rawTemplates = response.data.data || [];
      return rawTemplates.map((t: any) => {
        const components: MetaTemplateComponent[] = t.components || [];
        const variables: string[] = [];

        // Extract variables from body text like {{1}}, {{2}}
        components.forEach((comp) => {
          if (comp.text) {
            const matches = comp.text.match(/\{\{(\d+)\}\}/g);
            if (matches) {
              matches.forEach((m: string) => {
                const num = m.replace(/[\{\}]/g, '');
                if (!variables.includes(num)) variables.push(num);
              });
            }
          }
        });

        return {
          id: t.id,
          name: t.name,
          category: t.category,
          language: t.language,
          status: t.status,
          components,
          variables,
        };
      });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message;
      this.logger.error(`Failed to fetch Meta templates: ${msg}`);
      throw new Error(`Meta API error fetching templates: ${msg}`);
    }
  }

  /**
   * Sends an approved template message
   */
  async sendTemplateMessage(
    config: MetaConnectionConfig,
    toPhone: string,
    templateName: string,
    languageCode: string = 'en_US',
    variableValues: Record<string, string> = {},
  ): Promise<MetaSendResult> {
    try {
      const url = `${this.getBaseUrl(config.apiVersion)}/${config.phoneId}/messages`;
      // Clean phone number (Meta requires digits only, no + or spaces)
      const cleanPhone = toPhone.replace(/\D/g, '');

      // Build parameters array ordered by index
      const parameters = Object.keys(variableValues)
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        .map((key) => ({
          type: 'text',
          text: variableValues[key] || '',
        }));

      const componentsPayload: any[] = [];
      if (parameters.length > 0) {
        componentsPayload.push({
          type: 'body',
          parameters,
        });
      }

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: componentsPayload,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const providerMessageId = response.data?.messages?.[0]?.id || 'wamid.unknown';
      return {
        providerMessageId,
        status: 'sent',
      };
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message;
      this.logger.error(`Failed to send official Meta WhatsApp template message: ${msg}`);
      return {
        providerMessageId: '',
        status: 'failed',
        errorMessage: msg,
      };
    }
  }

  /**
   * Sends a direct text message (e.g. For customer service reply in 24h window)
   */
  async sendTextMessage(config: MetaConnectionConfig, toPhone: string, textBody: string): Promise<MetaSendResult> {
    try {
      const url = `${this.getBaseUrl(config.apiVersion)}/${config.phoneId}/messages`;
      const cleanPhone = toPhone.replace(/\D/g, '');

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: textBody,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const providerMessageId = response.data?.messages?.[0]?.id || 'wamid.unknown';
      return {
        providerMessageId,
        status: 'sent',
      };
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message;
      this.logger.error(`Failed to send official Meta WhatsApp text message: ${msg}`);
      return {
        providerMessageId: '',
        status: 'failed',
        errorMessage: msg,
      };
    }
  }
}
