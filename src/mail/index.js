/**
 * Temp Mail Factory - Multi-provider support with fallback
 * Providers ranked by reliability for magnific.ai registration:
 * 1. Kopeechka (paid, most reliable, real domains)
 * 2. Mail.tm (free, good API, decent acceptance)
 * 3. Guerrilla Mail (free, well-known, sometimes blocked)
 */
import { MailTmProvider } from './mail-tm.js';
import { GuerrillaMailProvider } from './guerrilla-mail.js';
import { KopeechkaProvider } from './kopeechka.js';
import { logger } from '../utils/logger.js';
import config from '../config.js';

/**
 * Create a mail provider instance based on configuration
 */
export function createMailProvider(providerName = null, proxyAgent = null) {
  const provider = providerName || config.tempMailProvider;

  switch (provider.toLowerCase()) {
    case 'kopeechka':
      if (!config.kopeechkaApiKey) {
        throw new Error('Kopeechka API key required. Set KOPEECHKA_API_KEY in .env');
      }
      return new KopeechkaProvider(config.kopeechkaApiKey, proxyAgent);

    case 'mail_tm':
    case 'mailtm':
      return new MailTmProvider(proxyAgent);

    case 'guerrilla':
    case 'guerrillamail':
      return new GuerrillaMailProvider(proxyAgent);

    default:
      logger.warn(`Unknown provider "${provider}", falling back to mail_tm`);
      return new MailTmProvider(proxyAgent);
  }
}

/**
 * Create a mail provider with automatic fallback
 * Tries providers in order of reliability until one works
 */
export async function createMailWithFallback(proxyAgent = null) {
  const providers = [];

  // Priority 1: Kopeechka (if API key available)
  if (config.kopeechkaApiKey) {
    providers.push('kopeechka');
  }

  // Priority 2: Mail.tm
  providers.push('mail_tm');

  // Priority 3: Guerrilla Mail
  providers.push('guerrilla');

  for (const providerName of providers) {
    try {
      const provider = createMailProvider(providerName, proxyAgent);
      const account = await provider.createAccount();

      if (account && account.email) {
        logger.info(`Using mail provider: ${provider.getName()} (${account.email})`);
        return { provider, account };
      }
    } catch (error) {
      logger.warn(`Provider ${providerName} failed: ${error.message}, trying next...`);
    }
  }

  throw new Error('All mail providers failed. Check your configuration and network.');
}

export { MailTmProvider, GuerrillaMailProvider, KopeechkaProvider };
