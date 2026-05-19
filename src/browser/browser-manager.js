/**
 * Browser Manager - Anti-detect browser session management
 * Uses Playwright with stealth plugin and custom fingerprint injection
 * Features: Proxy integration, fingerprint spoofing, human-like behavior
 */
import { chromium } from 'playwright';
import { generateFingerprint, generateInjectionScripts, generateUserAgent } from './fingerprint.js';
import { logger } from '../utils/logger.js';
import { sleep, randomInt, randomDelay } from '../utils/helpers.js';
import config from '../config.js';

export class BrowserManager {
  constructor(proxyManager = null) {
    this.proxyManager = proxyManager;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.fingerprint = null;
    this.proxy = null;
  }

  /**
   * Launch a new anti-detect browser session
   */
  async launch() {
    // Generate unique fingerprint for this session
    this.fingerprint = generateFingerprint();
    const userAgent = generateUserAgent(this.fingerprint.platform);

    logger.info(`Launching browser [${this.fingerprint.platform}] UA: ${userAgent.substring(0, 60)}...`);

    // Browser launch options
    const launchOptions = {
      headless: config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        `--window-size=${this.fingerprint.viewport.width},${this.fingerprint.viewport.height}`,
        '--ignore-certificate-errors',
        '--ignore-certifcate-errors-spki-list',
        `--lang=${this.fingerprint.locale}`,
      ],
    };

    // Proxy disabled - using direct connection
    // To re-enable: uncomment below and set PROXY_MODE in .env
    // if (this.proxyManager && this.proxyManager.hasProxies()) {
    //   const proxy = this.proxyManager.getNext();
    //   if (proxy) {
    //     this.proxy = proxy;
    //     launchOptions.proxy = this.proxyManager.getPlaywrightProxy(proxy);
    //     logger.info(`Using proxy: ${proxy.host}:${proxy.port}`);
    //   }
    // }
    logger.info('Using direct connection (no proxy)');

    this.browser = await chromium.launch(launchOptions);

    // Create context with fingerprint
    const contextOptions = {
      userAgent: userAgent,
      viewport: {
        width: this.fingerprint.viewport.width,
        height: this.fingerprint.viewport.height,
      },
      screen: {
        width: this.fingerprint.screen.width,
        height: this.fingerprint.screen.height,
      },
      locale: this.fingerprint.locale,
      timezoneId: this.fingerprint.timezone,
      colorScheme: 'light',
      deviceScaleFactor: pickRandom([1, 1.25, 1.5, 2]),
      hasTouch: this.fingerprint.maxTouchPoints > 0,
      javaScriptEnabled: true,
      acceptDownloads: false,
      ignoreHTTPSErrors: true,
      // Permissions
      permissions: ['geolocation'],
      geolocation: this.getGeolocationForTimezone(this.fingerprint.timezone),
    };

    this.context = await this.browser.newContext(contextOptions);

    // Inject anti-detect scripts before any page loads
    await this.context.addInitScript(generateInjectionScripts(this.fingerprint));

    // Additional stealth: override navigator.webdriver
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Create page
    this.page = await this.context.newPage();

    // Block unnecessary resources for speed
    await this.page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf}', route => {
      // Allow images on magnific pages (may need for captcha)
      if (route.request().url().includes('magnific') || route.request().url().includes('freepik')) {
        route.continue();
      } else {
        route.abort();
      }
    });

    // Block known tracking/analytics
    await this.page.route('**/{analytics,tracking,pixel,beacon}**', route => route.abort());
    await this.page.route('**/google-analytics.com/**', route => route.abort());
    await this.page.route('**/googletagmanager.com/**', route => route.abort());

    logger.info('Browser session ready with anti-detect fingerprint');
    return this.page;
  }

  /**
   * Simulate human-like typing with variable speed
   */
  async humanType(selector, text, options = {}) {
    const { minDelay = 50, maxDelay = 150, mistakes = true } = options;

    await this.page.click(selector);
    await sleep(randomInt(200, 500));

    for (let i = 0; i < text.length; i++) {
      // Occasionally make a typo and correct it (human behavior)
      if (mistakes && Math.random() < 0.03 && i > 0) {
        const wrongChar = String.fromCharCode(text.charCodeAt(i) + randomInt(-2, 2));
        await this.page.keyboard.type(wrongChar, { delay: randomInt(minDelay, maxDelay) });
        await sleep(randomInt(100, 300));
        await this.page.keyboard.press('Backspace');
        await sleep(randomInt(50, 150));
      }

      await this.page.keyboard.type(text[i], { delay: randomInt(minDelay, maxDelay) });

      // Random pauses (like thinking)
      if (Math.random() < 0.05) {
        await sleep(randomInt(200, 800));
      }
    }
  }

  /**
   * Simulate human-like mouse movement and click
   */
  async humanClick(selector, options = {}) {
    const element = await this.page.waitForSelector(selector, { timeout: 10000 });
    const box = await element.boundingBox();

    if (box) {
      // Move to element with some randomness
      const x = box.x + box.width * (0.3 + Math.random() * 0.4);
      const y = box.y + box.height * (0.3 + Math.random() * 0.4);

      await this.page.mouse.move(x, y, {
        steps: randomInt(5, 15),
      });

      await sleep(randomInt(50, 200));
      await this.page.mouse.click(x, y);
    } else {
      await element.click();
    }

    await sleep(randomInt(300, 800));
  }

  /**
   * Simulate random scrolling (human behavior)
   */
  async humanScroll(options = {}) {
    const { minScroll = 100, maxScroll = 400, times = null } = options;
    const scrollTimes = times || randomInt(1, 3);

    for (let i = 0; i < scrollTimes; i++) {
      const amount = randomInt(minScroll, maxScroll);
      await this.page.mouse.wheel(0, amount);
      await sleep(randomInt(500, 1500));
    }
  }

  /**
   * Wait for page to be fully loaded with human-like patience
   */
  async waitForPageReady(options = {}) {
    const { timeout = 30000 } = options;
    await this.page.waitForLoadState('networkidle', { timeout });
    await sleep(randomInt(1000, 3000));
  }

  /**
   * Navigate to URL with human-like behavior
   */
  async navigateTo(url, options = {}) {
    const { waitFor = 'networkidle', timeout = 60000 } = options;
    logger.info(`Navigating to: ${url}`);

    await this.page.goto(url, { waitUntil: waitFor, timeout });
    await sleep(randomInt(1500, 3000));

    // Random scroll after page load
    if (Math.random() < 0.5) {
      await this.humanScroll({ times: 1 });
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name = 'debug') {
    const path = `logs/screenshots/${name}-${Date.now()}.png`;
    await this.page.screenshot({ path, fullPage: false });
    logger.info(`Screenshot saved: ${path}`);
    return path;
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      logger.info('Browser session closed');
    } catch (error) {
      logger.warn(`Error closing browser: ${error.message}`);
    }
  }

  /**
   * Get geolocation based on timezone
   */
  getGeolocationForTimezone(timezone) {
    const geoMap = {
      'America/New_York': { latitude: 40.7128, longitude: -74.0060 },
      'America/Chicago': { latitude: 41.8781, longitude: -87.6298 },
      'America/Denver': { latitude: 39.7392, longitude: -104.9903 },
      'America/Los_Angeles': { latitude: 34.0522, longitude: -118.2437 },
      'Europe/London': { latitude: 51.5074, longitude: -0.1278 },
      'Europe/Paris': { latitude: 48.8566, longitude: 2.3522 },
      'Europe/Berlin': { latitude: 52.5200, longitude: 13.4050 },
      'Asia/Tokyo': { latitude: 35.6762, longitude: 139.6503 },
      'Asia/Singapore': { latitude: 1.3521, longitude: 103.8198 },
      'Australia/Sydney': { latitude: -33.8688, longitude: 151.2093 },
      'America/Toronto': { latitude: 43.6532, longitude: -79.3832 },
      'Europe/Amsterdam': { latitude: 52.3676, longitude: 4.9041 },
    };

    const geo = geoMap[timezone] || { latitude: 40.7128, longitude: -74.0060 };
    // Add small random offset for uniqueness
    return {
      latitude: geo.latitude + (Math.random() - 0.5) * 0.1,
      longitude: geo.longitude + (Math.random() - 0.5) * 0.1,
    };
  }

  /**
   * Get current proxy info
   */
  getProxyInfo() {
    return this.proxy;
  }

  /**
   * Report proxy failure (for rotation)
   */
  reportProxyFailure() {
    if (this.proxy && this.proxyManager) {
      this.proxyManager.blacklist(this.proxy);
    }
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default BrowserManager;
