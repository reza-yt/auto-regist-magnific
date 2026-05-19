/**
 * Guerrilla Mail Temp Mail Provider
 * Free API - no registration required
 * Known for reliability and acceptance by most services
 * API: https://www.guerrillamail.com/GuerrillaMailAPI.html
 */
import axios from 'axios';
import { sleep, retry } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://api.guerrillamail.com/ajax.php';

export class GuerrillaMailProvider {
  constructor(proxyAgent = null) {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      ...(proxyAgent ? { httpAgent: proxyAgent, httpsAgent: proxyAgent } : {}),
    });
    this.sidToken = null;
    this.email = null;
    this.emailUser = null;
  }

  /**
   * Get a new random email address
   */
  async createAccount() {
    return await retry(async () => {
      logger.info('Creating Guerrilla Mail account...');

      // Get email address
      const response = await this.client.get(BASE_URL, {
        params: {
          f: 'get_email_address',
          lang: 'en',
        },
      });

      const data = response.data;
      this.sidToken = data.sid_token;
      this.email = data.email_addr;
      this.emailUser = data.email_user;

      logger.info(`Guerrilla Mail account created: ${this.email}`);

      return {
        email: this.email,
        password: null, // Guerrilla doesn't use passwords
        id: this.sidToken,
      };
    }, 3, 2000);
  }

  /**
   * Set a custom email user (prefix before @)
   */
  async setEmailUser(emailUser) {
    const response = await this.client.get(BASE_URL, {
      params: {
        f: 'set_email_user',
        email_user: emailUser,
        lang: 'en',
        sid_token: this.sidToken,
      },
    });

    this.email = response.data.email_addr;
    this.emailUser = emailUser;
    return this.email;
  }

  /**
   * Check inbox for new emails
   */
  async getMessages() {
    if (!this.sidToken) {
      throw new Error('No session. Call createAccount() first.');
    }

    const response = await this.client.get(BASE_URL, {
      params: {
        f: 'check_email',
        seq: 0,
        sid_token: this.sidToken,
      },
    });

    return response.data.list || [];
  }

  /**
   * Fetch a specific email by ID
   */
  async getMessage(emailId) {
    const response = await this.client.get(BASE_URL, {
      params: {
        f: 'fetch_email',
        email_id: emailId,
        sid_token: this.sidToken,
      },
    });

    return response.data;
  }

  /**
   * Wait for verification email
   */
  async waitForVerificationEmail(options = {}) {
    const {
      timeout = 120000,
      pollInterval = 5000,
      senderKeywords = ['magnific', 'freepik', 'noreply', 'verify', 'confirm'],
      subjectKeywords = ['verify', 'confirm', 'activate', 'welcome', 'registration'],
    } = options;

    const startTime = Date.now();
    logger.info(`[Guerrilla] Waiting for verification email (timeout: ${timeout / 1000}s)...`);

    while (Date.now() - startTime < timeout) {
      try {
        const messages = await this.getMessages();

        for (const msg of messages) {
          const from = (msg.mail_from || '').toLowerCase();
          const subject = (msg.mail_subject || '').toLowerCase();

          const fromMatch = senderKeywords.some(kw => from.includes(kw));
          const subjectMatch = subjectKeywords.some(kw => subject.includes(kw));

          if (fromMatch || subjectMatch) {
            logger.info(`[Guerrilla] Verification email found! Subject: ${msg.mail_subject}`);
            const fullMessage = await this.getMessage(msg.mail_id);
            return {
              id: msg.mail_id,
              from: msg.mail_from,
              subject: msg.mail_subject,
              html: fullMessage.mail_body || '',
              text: fullMessage.mail_excerpt || '',
              body: fullMessage.mail_body || fullMessage.mail_excerpt || '',
            };
          }
        }
      } catch (error) {
        logger.warn(`[Guerrilla] Error checking mail: ${error.message}`);
      }

      await sleep(pollInterval);
    }

    throw new Error(`[Guerrilla] Verification email not received within ${timeout / 1000}s`);
  }

  /**
   * Forget/delete the session
   */
  async deleteAccount() {
    if (!this.sidToken) return;
    try {
      await this.client.get(BASE_URL, {
        params: {
          f: 'forget_me',
          email_addr: this.email,
          sid_token: this.sidToken,
        },
      });
      logger.info(`Guerrilla Mail session ended: ${this.email}`);
    } catch (error) {
      logger.warn(`Failed to end Guerrilla session: ${error.message}`);
    }
  }

  getName() {
    return 'guerrilla';
  }
}

export default GuerrillaMailProvider;
