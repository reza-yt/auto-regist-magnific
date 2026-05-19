/**
 * Kopeechka.store Mail Provider (Paid - Most Reliable)
 * Specifically designed for service registrations
 * Supports many services and has high deliverability
 * Great for bypassing temp mail blocks
 */
import axios from 'axios';
import { sleep, retry } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://api.kopeechka.store';

export class KopeechkaProvider {
  constructor(apiKey, proxyAgent = null) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      ...(proxyAgent ? { httpAgent: proxyAgent, httpsAgent: proxyAgent } : {}),
    });
    this.email = null;
    this.taskId = null;
  }

  /**
   * Get available domains for a specific site
   */
  async getDomains(site = 'magnific.ai') {
    try {
      const response = await this.client.get('/api', {
        params: {
          api: this.apiKey,
          action: 'get_domains',
          site: site,
          type: 'json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`Kopeechka getDomains error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Order a temporary email for registration
   */
  async createAccount(options = {}) {
    const {
      site = 'magnific.ai',
      mail_type = null, // null = any available domain
      regex = '.*', // regex for sender matching
    } = options;

    return await retry(async () => {
      logger.info(`[Kopeechka] Ordering email for site: ${site}...`);

      const params = {
        api: this.apiKey,
        action: 'mailbox',
        site: site,
        mail_type: mail_type || 'REAL', // REAL domains have better deliverability
        type: 'json',
        regex: regex,
      };

      const response = await this.client.get('/api', { params });
      const data = response.data;

      if (data.status !== 'OK') {
        throw new Error(`Kopeechka order failed: ${data.value || JSON.stringify(data)}`);
      }

      this.email = data.mail;
      this.taskId = data.id;

      logger.info(`[Kopeechka] Email ordered: ${this.email} (task: ${this.taskId})`);

      return {
        email: this.email,
        password: null,
        id: this.taskId,
      };
    }, 3, 3000);
  }

  /**
   * Check for received message
   */
  async getMessage() {
    const response = await this.client.get('/api', {
      params: {
        api: this.apiKey,
        action: 'reorder',
        id: this.taskId,
        type: 'json',
      },
    });

    return response.data;
  }

  /**
   * Wait for verification email and get the verification link/code
   */
  async waitForVerificationEmail(options = {}) {
    const {
      timeout = 180000, // 3 minutes for paid service
      pollInterval = 5000,
    } = options;

    const startTime = Date.now();
    logger.info(`[Kopeechka] Waiting for message (timeout: ${timeout / 1000}s)...`);

    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.client.get('/api', {
          params: {
            api: this.apiKey,
            action: 'getmessage',
            id: this.taskId,
            type: 'json',
            full: 1, // Get full message body
          },
        });

        const data = response.data;

        if (data.status === 'OK' && data.value) {
          logger.info(`[Kopeechka] Message received!`);
          return {
            id: this.taskId,
            from: data.from || '',
            subject: data.subject || '',
            html: data.fullmessage || data.value || '',
            text: data.value || '',
            body: data.fullmessage || data.value || '',
          };
        }

        if (data.status === 'ERROR') {
          throw new Error(`Kopeechka error: ${data.value}`);
        }
      } catch (error) {
        if (error.message.includes('Kopeechka error')) throw error;
        logger.warn(`[Kopeechka] Poll error: ${error.message}`);
      }

      await sleep(pollInterval);
    }

    throw new Error(`[Kopeechka] Message not received within ${timeout / 1000}s`);
  }

  /**
   * Cancel/release the email task
   */
  async deleteAccount() {
    if (!this.taskId) return;
    try {
      await this.client.get('/api', {
        params: {
          api: this.apiKey,
          action: 'cancel',
          id: this.taskId,
          type: 'json',
        },
      });
      logger.info(`[Kopeechka] Task cancelled: ${this.taskId}`);
    } catch (error) {
      logger.warn(`[Kopeechka] Failed to cancel: ${error.message}`);
    }
  }

  /**
   * Get balance
   */
  async getBalance() {
    const response = await this.client.get('/api', {
      params: {
        api: this.apiKey,
        action: 'balance',
        type: 'json',
      },
    });
    return response.data;
  }

  getName() {
    return 'kopeechka';
  }
}

export default KopeechkaProvider;
