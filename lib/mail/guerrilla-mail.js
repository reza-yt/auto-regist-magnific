/**
 * Guerrilla Mail Provider (Serverless)
 * Free API - no registration required
 */
import axios from 'axios';
import { sleep } from '../utils/helpers';

const BASE_URL = 'https://api.guerrillamail.com/ajax.php';

export class GuerrillaMailProvider {
  constructor() {
    this.client = axios.create({ timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    this.sidToken = null;
    this.email = null;
  }

  async createAccount() {
    const res = await this.client.get(BASE_URL, { params: { f: 'get_email_address', lang: 'en' } });
    this.sidToken = res.data.sid_token;
    this.email = res.data.email_addr;
    return { email: this.email, password: null, id: this.sidToken };
  }

  async getMessages() {
    if (!this.sidToken) throw new Error('No session');
    const res = await this.client.get(BASE_URL, { params: { f: 'check_email', seq: 0, sid_token: this.sidToken } });
    return res.data.list || [];
  }

  async getMessage(emailId) {
    const res = await this.client.get(BASE_URL, { params: { f: 'fetch_email', email_id: emailId, sid_token: this.sidToken } });
    return res.data;
  }

  async waitForVerificationEmail(options = {}) {
    const { timeout = 120000, pollInterval = 5000, senderKeywords = ['magnific', 'freepik', 'noreply', 'verify'], subjectKeywords = ['verify', 'confirm', 'activate', 'welcome'] } = options;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const messages = await this.getMessages();
        for (const msg of messages) {
          const from = (msg.mail_from || '').toLowerCase();
          const subject = (msg.mail_subject || '').toLowerCase();
          if (senderKeywords.some(kw => from.includes(kw)) || subjectKeywords.some(kw => subject.includes(kw))) {
            const full = await this.getMessage(msg.mail_id);
            return { id: msg.mail_id, from: msg.mail_from, subject: msg.mail_subject, html: full.mail_body || '', text: full.mail_excerpt || '', body: full.mail_body || '' };
          }
        }
      } catch (e) {}
      await sleep(pollInterval);
    }
    throw new Error('Verification email timeout');
  }

  async deleteAccount() {
    if (!this.sidToken) return;
    try { await this.client.get(BASE_URL, { params: { f: 'forget_me', email_addr: this.email, sid_token: this.sidToken } }); } catch (e) {}
  }

  getName() { return 'guerrilla'; }
}
