/**
 * Mail.tm Temp Mail Provider
 * Free REST API - no API key required
 * Supports: create account, get messages, read message content
 * API Docs: https://api.mail.tm/
 */
import axios from 'axios';
import { sleep, retry } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://api.mail.tm';

export class MailTmProvider {
  constructor(proxyAgent = null) {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...(proxyAgent ? { httpAgent: proxyAgent, httpsAgent: proxyAgent } : {}),
    });
    this.token = null;
    this.email = null;
    this.password = null;
    this.accountId = null;
  }

  /**
   * Get available domains from Mail.tm
   */
  async getDomains() {
    try {
      const response = await this.client.get('/domains');
      const domains = response.data['hydra:member'] || response.data;
      if (!domains || domains.length === 0) {
        throw new Error('No domains available from Mail.tm');
      }
      return domains.map(d => d.domain);
    } catch (error) {
      logger.error(`Mail.tm getDomains error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new temp email account
   */
  async createAccount() {
    return await retry(async () => {
      const domains = await this.getDomains();
      const domain = domains[Math.floor(Math.random() * domains.length)];

      // Generate random address
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let localPart = '';
      for (let i = 0; i < 12; i++) {
        localPart += chars[Math.floor(Math.random() * chars.length)];
      }

      this.email = `${localPart}@${domain}`;
      this.password = `Pass${Math.random().toString(36).slice(2)}!${Math.floor(Math.random() * 999)}`;

      logger.info(`Creating Mail.tm account: ${this.email}`);

      const response = await this.client.post('/accounts', {
        address: this.email,
        password: this.password,
      });

      this.accountId = response.data.id;
      logger.info(`Mail.tm account created successfully: ${this.email}`);

      // Login to get token
      await this.login();

      return {
        email: this.email,
        password: this.password,
        id: this.accountId,
      };
    }, 3, 2000);
  }

  /**
   * Login and get JWT token
   */
  async login() {
    const response = await this.client.post('/token', {
      address: this.email,
      password: this.password,
    });

    this.token = response.data.token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    return this.token;
  }

  /**
   * Get all messages in inbox
   */
  async getMessages() {
    if (!this.token) {
      await this.login();
    }

    const response = await this.client.get('/messages');
    return response.data['hydra:member'] || response.data || [];
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId) {
    if (!this.token) {
      await this.login();
    }

    const response = await this.client.get(`/messages/${messageId}`);
    return response.data;
  }

  /**
   * Wait for a verification email to arrive
   * Polls inbox every few seconds until email found or timeout
   */
  async waitForVerificationEmail(options = {}) {
    const {
      timeout = 120000,       // 2 minutes timeout
      pollInterval = 5000,    // Poll every 5 seconds
      senderKeywords = ['magnific', 'freepik', 'noreply', 'verify', 'confirm'],
      subjectKeywords = ['verify', 'confirm', 'activate', 'welcome', 'registration'],
    } = options;

    const startTime = Date.now();
    logger.info(`Waiting for verification email (timeout: ${timeout / 1000}s)...`);

    while (Date.now() - startTime < timeout) {
      try {
        const messages = await this.getMessages();

        for (const msg of messages) {
          const from = (msg.from?.address || '').toLowerCase();
          const subject = (msg.subject || '').toLowerCase();

          // Check if it's from magnific/freepik or contains verification keywords
          const fromMatch = senderKeywords.some(kw => from.includes(kw));
          const subjectMatch = subjectKeywords.some(kw => subject.includes(kw));

          if (fromMatch || subjectMatch) {
            logger.info(`Verification email found! Subject: ${msg.subject}`);
            // Get full message content
            const fullMessage = await this.getMessage(msg.id);
            return {
              id: msg.id,
              from: msg.from,
              subject: msg.subject,
              html: fullMessage.html || '',
              text: fullMessage.text || '',
              body: fullMessage.html || fullMessage.text || '',
            };
          }
        }
      } catch (error) {
        logger.warn(`Error checking mail: ${error.message}`);
      }

      await sleep(pollInterval);
    }

    throw new Error(`Verification email not received within ${timeout / 1000}s`);
  }

  /**
   * Delete the account (cleanup)
   */
  async deleteAccount() {
    if (!this.token || !this.accountId) return;
    try {
      await this.client.delete(`/accounts/${this.accountId}`);
      logger.info(`Mail.tm account deleted: ${this.email}`);
    } catch (error) {
      logger.warn(`Failed to delete Mail.tm account: ${error.message}`);
    }
  }

  /**
   * Get provider name
   */
  getName() {
    return 'mail.tm';
  }
}

export default MailTmProvider;
