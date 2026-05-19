/**
 * Mail.tm Temp Mail Provider (Serverless)
 * Free REST API - no key required
 */
import axios from 'axios';
import { sleep } from '../utils/helpers';

const BASE_URL = 'https://api.mail.tm';

export class MailTmProvider {
  constructor() {
    this.client = axios.create({ baseURL: BASE_URL, timeout: 30000, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } });
    this.token = null;
    this.email = null;
    this.password = null;
    this.accountId = null;
  }

  async getDomains() {
    const res = await this.client.get('/domains');
    const domains = res.data['hydra:member'] || res.data;
    if (!domains || domains.length === 0) throw new Error('No Mail.tm domains available');
    return domains.map(d => d.domain);
  }

  async createAccount() {
    const domains = await this.getDomains();
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let local = '';
    for (let i = 0; i < 12; i++) local += chars[Math.floor(Math.random() * chars.length)];

    this.email = `${local}@${domain}`;
    this.password = `Pass${Math.random().toString(36).slice(2)}!${Math.floor(Math.random() * 999)}`;

    const res = await this.client.post('/accounts', { address: this.email, password: this.password });
    this.accountId = res.data.id;
    await this.login();
    return { email: this.email, password: this.password, id: this.accountId };
  }

  async login() {
    const res = await this.client.post('/token', { address: this.email, password: this.password });
    this.token = res.data.token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
  }

  async getMessages() {
    if (!this.token) await this.login();
    const res = await this.client.get('/messages');
    return res.data['hydra:member'] || res.data || [];
  }

  async getMessage(id) {
    if (!this.token) await this.login();
    const res = await this.client.get(`/messages/${id}`);
    return res.data;
  }

  async waitForVerificationEmail(options = {}) {
    const { timeout = 120000, pollInterval = 5000, senderKeywords = ['magnific', 'freepik', 'noreply', 'verify', 'confirm'], subjectKeywords = ['verify', 'confirm', 'activate', 'welcome', 'registration'] } = options;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const messages = await this.getMessages();
        for (const msg of messages) {
          const from = (msg.from?.address || '').toLowerCase();
          const subject = (msg.subject || '').toLowerCase();
          if (senderKeywords.some(kw => from.includes(kw)) || subjectKeywords.some(kw => subject.includes(kw))) {
            const full = await this.getMessage(msg.id);
            return { id: msg.id, from: msg.from, subject: msg.subject, html: full.html || '', text: full.text || '', body: full.html || full.text || '' };
          }
        }
      } catch (e) {}
      await sleep(pollInterval);
    }
    throw new Error('Verification email timeout');
  }

  async deleteAccount() {
    if (!this.token || !this.accountId) return;
    try { await this.client.delete(`/accounts/${this.accountId}`); } catch (e) {}
  }

  getName() { return 'mail.tm'; }
}
