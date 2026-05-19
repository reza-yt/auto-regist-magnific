/**
 * Magnific.ai API Key Extraction Module
 * After successful registration and verification:
 * 1. Login to account
 * 2. Navigate to API settings/dashboard
 * 3. Generate or copy API key
 * 4. Save to local file
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { logger, logStep, logSuccess, logError } from '../utils/logger.js';
import { sleep, randomDelay, retry } from '../utils/helpers.js';
import { BrowserManager } from '../browser/browser-manager.js';
import config from '../config.js';

export class ApiKeyExtractor {
  constructor(proxyManager) {
    this.proxyManager = proxyManager;
    this.browser = null;
  }

  /**
   * Full flow: Login -> Navigate to API page -> Extract/Generate key -> Save
   */
  async extractApiKey(credentials) {
    const { email, password } = credentials;
    this.browser = new BrowserManager(this.proxyManager);

    try {
      logStep('API-1', 'Launching browser for API key extraction...');
      const page = await this.browser.launch();

      // Step 1: Login
      logStep('API-2', 'Logging in to Magnific.ai...');
      await this.login(page, email, password);

      // Step 2: Navigate to API page
      logStep('API-3', 'Navigating to API settings...');
      await this.navigateToApiPage(page);

      // Step 3: Extract or Generate API key
      logStep('API-4', 'Extracting API key...');
      const apiKey = await this.getApiKey(page);

      if (!apiKey) {
        throw new Error('Could not extract API key');
      }

      // Step 4: Save to file
      logStep('API-5', 'Saving API key to file...');
      this.saveApiKey(email, password, apiKey);

      logSuccess(`API key extracted successfully: ${apiKey.substring(0, 8)}...`);

      return {
        email,
        password,
        apiKey,
        extractedAt: new Date().toISOString(),
      };

    } catch (error) {
      logError(`API key extraction failed: ${error.message}`);

      if (this.browser && this.browser.page) {
        try {
          await this.browser.screenshot('apikey-error');
        } catch (e) {}
      }

      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Login to Magnific.ai
   */
  async login(page, email, password) {
    const loginUrls = [
      'https://magnific.ai/login',
      'https://magnific.ai/signin',
      'https://magnific.ai/api',
    ];

    let loggedIn = false;

    for (const url of loginUrls) {
      try {
        await this.browser.navigateTo(url, { timeout: 30000 });
        await sleep(randomDelay(2000));

        // Look for login form
        const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
        if (!emailInput) {
          // Maybe there's a "Login" or "Sign in" button first
          const loginBtn = await page.$('a:has-text("Log in"), a:has-text("Sign in"), button:has-text("Log in"), button:has-text("Sign in")');
          if (loginBtn) {
            await loginBtn.click();
            await sleep(randomDelay(2000));
          }
        }

        // Fill email
        const emailSelectors = [
          'input[type="email"]', 'input[name="email"]',
          'input[placeholder*="email" i]', 'input[id*="email" i]',
        ];
        const emailFilled = await this.fillField(page, emailSelectors, email);

        if (!emailFilled) continue;

        await sleep(randomDelay(800));

        // Fill password
        const passwordSelectors = [
          'input[type="password"]', 'input[name="password"]',
          'input[placeholder*="password" i]',
        ];
        await this.fillField(page, passwordSelectors, password);

        await sleep(randomDelay(1000));

        // Submit login
        const submitSelectors = [
          'button[type="submit"]',
          'button:has-text("Log in")',
          'button:has-text("Sign in")',
          'button:has-text("Continue")',
          'button:has-text("Login")',
          'input[type="submit"]',
        ];

        for (const sel of submitSelectors) {
          const btn = await page.$(sel);
          if (btn && await btn.isVisible()) {
            await this.browser.humanClick(sel);
            break;
          }
        }

        await sleep(randomDelay(5000));
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

        // Verify login success
        const currentUrl = page.url();
        if (currentUrl.includes('dashboard') || currentUrl.includes('app') ||
            currentUrl.includes('home') || currentUrl.includes('api') ||
            !currentUrl.includes('login')) {
          loggedIn = true;
          logSuccess('Login successful');
          break;
        }

      } catch (error) {
        logger.warn(`Login attempt at ${url} failed: ${error.message}`);
      }
    }

    if (!loggedIn) {
      throw new Error('Could not login to Magnific.ai');
    }
  }

  /**
   * Navigate to API key management page
   */
  async navigateToApiPage(page) {
    const apiUrls = [
      'https://magnific.ai/api',
      'https://magnific.ai/api/keys',
      'https://magnific.ai/dashboard/api',
      'https://magnific.ai/settings/api',
      'https://magnific.ai/account/api',
      'https://magnific.ai/developer',
    ];

    for (const url of apiUrls) {
      try {
        await this.browser.navigateTo(url, { timeout: 20000 });
        await sleep(randomDelay(2000));

        // Check if we can see API key content
        const hasApiContent = await this.detectApiKeyPage(page);
        if (hasApiContent) {
          logger.info(`API key page found at: ${url}`);
          return;
        }
      } catch (error) {
        continue;
      }
    }

    // Try navigating via dashboard links
    try {
      const apiLinks = [
        'a[href*="api"]', 'a[href*="developer"]', 'a[href*="keys"]',
        'a:has-text("API")', 'a:has-text("Developer")', 'a:has-text("Keys")',
        'button:has-text("API")', '[data-testid*="api"]',
      ];

      for (const selector of apiLinks) {
        const link = await page.$(selector);
        if (link && await link.isVisible()) {
          await link.click();
          await sleep(randomDelay(3000));
          const hasContent = await this.detectApiKeyPage(page);
          if (hasContent) return;
        }
      }
    } catch (error) {
      logger.warn(`Dashboard navigation failed: ${error.message}`);
    }

    logger.warn('Could not find dedicated API key page - attempting extraction from current page');
  }

  /**
   * Detect if current page shows API key content
   */
  async detectApiKeyPage(page) {
    const indicators = [
      'text="API Key"', 'text="api key"', 'text="API key"',
      'text="x-magnific-api-key"',
      '[data-testid*="api-key"]',
      'input[readonly]', 'code', '.api-key',
      'button:has-text("Generate")', 'button:has-text("Create key")',
      'button:has-text("Copy")', 'button:has-text("Reveal")',
    ];

    for (const selector of indicators) {
      try {
        const el = await page.$(selector);
        if (el) return true;
      } catch (e) {}
    }
    return false;
  }

  /**
   * Extract API key from page or generate new one
   */
  async getApiKey(page) {
    // Method 1: Look for existing visible API key
    let apiKey = await this.findExistingKey(page);
    if (apiKey) return apiKey;

    // Method 2: Click "Generate" or "Create" button
    apiKey = await this.generateNewKey(page);
    if (apiKey) return apiKey;

    // Method 3: Look for key in page source/network requests
    apiKey = await this.extractFromPageContent(page);
    if (apiKey) return apiKey;

    // Method 4: Try intercepting network responses
    apiKey = await this.interceptApiKey(page);
    if (apiKey) return apiKey;

    return null;
  }

  /**
   * Find an existing API key displayed on page
   */
  async findExistingKey(page) {
    const keySelectors = [
      // Common patterns for displayed API keys
      'input[readonly][value]',
      '.api-key code', '.api-key span', '.api-key input',
      '[data-testid*="api-key"]',
      'code:has-text("magnific")',
      'pre:has-text("magnific")',
      'input[value*="magnific"]',
      '.key-value', '.token-value', '.secret-value',
      '[class*="apiKey"]', '[class*="api-key"]',
    ];

    for (const selector of keySelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          let value = await el.getAttribute('value') || await el.textContent();
          value = value?.trim();
          if (value && this.looksLikeApiKey(value)) {
            logger.info(`Found API key via selector: ${selector}`);
            return value;
          }
        }
      } catch (e) {}
    }

    // Try to find "Reveal" button first
    const revealSelectors = [
      'button:has-text("Reveal")', 'button:has-text("Show")',
      'button:has-text("View")', '.reveal-btn', '.show-key',
      'button[aria-label*="reveal" i]', 'button[aria-label*="show" i]',
    ];

    for (const selector of revealSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn && await btn.isVisible()) {
          await btn.click();
          await sleep(randomDelay(2000));
          // Re-check for visible key
          for (const keySelector of keySelectors) {
            const el = await page.$(keySelector);
            if (el) {
              let value = await el.getAttribute('value') || await el.textContent();
              value = value?.trim();
              if (value && this.looksLikeApiKey(value)) {
                return value;
              }
            }
          }
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Generate a new API key by clicking generate button
   */
  async generateNewKey(page) {
    const generateSelectors = [
      'button:has-text("Generate")', 'button:has-text("Create key")',
      'button:has-text("Create API")', 'button:has-text("New key")',
      'button:has-text("Generate key")', 'button:has-text("Create new")',
      'a:has-text("Generate")', 'a:has-text("Create key")',
      '[data-testid*="generate"]', '[data-testid*="create-key"]',
    ];

    for (const selector of generateSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn && await btn.isVisible()) {
          await this.browser.humanClick(selector);
          await sleep(randomDelay(3000));

          // After generating, look for the newly created key
          // Often shown in a modal or notification
          const modalKey = await this.findKeyInModal(page);
          if (modalKey) return modalKey;

          // Check page again
          const key = await this.findExistingKey(page);
          if (key) return key;
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Look for API key in a modal/dialog that appeared
   */
  async findKeyInModal(page) {
    const modalSelectors = [
      '.modal', '[role="dialog"]', '.dialog', '.popup',
      '[aria-modal="true"]', '.overlay-content',
    ];

    for (const selector of modalSelectors) {
      try {
        const modal = await page.$(selector);
        if (modal) {
          const content = await modal.textContent();
          const key = this.extractKeyFromText(content);
          if (key) return key;

          // Look for copy button in modal and check input
          const input = await modal.$('input[readonly], input[type="text"], code, pre');
          if (input) {
            const value = (await input.getAttribute('value') || await input.textContent())?.trim();
            if (value && this.looksLikeApiKey(value)) return value;
          }
        }
      } catch (e) {}
    }
    return null;
  }

  /**
   * Extract from page content using regex
   */
  async extractFromPageContent(page) {
    try {
      const content = await page.content();
      return this.extractKeyFromText(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Intercept network requests that might contain API key
   */
  async interceptApiKey(page) {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => resolve(null), 15000);

      // Listen for responses that might contain API key
      page.on('response', async (response) => {
        try {
          const url = response.url();
          if (url.includes('api') || url.includes('key') || url.includes('token')) {
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('json')) {
              const body = await response.json();
              const key = this.findKeyInObject(body);
              if (key) {
                clearTimeout(timeout);
                resolve(key);
              }
            }
          }
        } catch (e) {}
      });

      // Trigger a page reload to capture responses
      await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
      await sleep(5000);
      clearTimeout(timeout);
      resolve(null);
    });
  }

  /**
   * Recursively search object for API key
   */
  findKeyInObject(obj, depth = 0) {
    if (depth > 5 || !obj) return null;

    if (typeof obj === 'string' && this.looksLikeApiKey(obj)) {
      return obj;
    }

    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (['api_key', 'apiKey', 'api-key', 'key', 'token', 'secret'].includes(key)) {
          if (typeof value === 'string' && this.looksLikeApiKey(value)) {
            return value;
          }
        }
        const found = this.findKeyInObject(value, depth + 1);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Extract API key from text using regex patterns
   */
  extractKeyFromText(text) {
    if (!text) return null;

    // Common API key patterns
    const patterns = [
      /(?:api[_-]?key|token|secret)['":\s]*['"]?([a-zA-Z0-9_-]{20,128})['"]?/gi,
      /magnific[_-]?[a-zA-Z0-9_-]{20,64}/gi,
      /(?:mk|mag|mf)[_-][a-zA-Z0-9]{20,64}/gi,
      /[a-f0-9]{32,64}/g, // Hex keys
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const key = match[1] || match[0];
        if (this.looksLikeApiKey(key)) {
          return key;
        }
      }
    }
    return null;
  }

  /**
   * Heuristic check if a string looks like an API key
   */
  looksLikeApiKey(str) {
    if (!str || typeof str !== 'string') return false;
    const cleaned = str.trim();
    // Must be at least 20 chars, alphanumeric with possible dashes/underscores
    if (cleaned.length < 20 || cleaned.length > 128) return false;
    if (/^[a-zA-Z0-9_-]+$/.test(cleaned)) return true;
    if (/^[a-f0-9]+$/i.test(cleaned) && cleaned.length >= 32) return true;
    return false;
  }

  /**
   * Fill a form field
   */
  async fillField(page, selectors, value) {
    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el && await el.isVisible()) {
          await this.browser.humanType(selector, value);
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  /**
   * Save API key to output file
   */
  saveApiKey(email, password, apiKey) {
    const outputFile = config.outputFile;
    const dir = dirname(outputFile);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}]\nEmail: ${email}\nPassword: ${password}\nAPI Key: ${apiKey}\n${'='.repeat(60)}\n\n`;

    appendFileSync(outputFile, entry, 'utf-8');
    logSuccess(`API key saved to: ${outputFile}`);
  }
}

export default ApiKeyExtractor;
