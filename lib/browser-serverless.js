/**
 * Serverless Browser Manager
 * Uses playwright-core + @sparticuz/chromium for Vercel deployment
 * Includes anti-detect fingerprint injection
 */
import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import { generateFingerprint, generateInjectionScripts, generateUserAgent } from './browser/fingerprint';

/**
 * Create a browser instance optimized for serverless environment
 */
export async function createServerlessBrowser(options = {}) {
  const { proxy = null, headless = true } = options;

  // Generate unique fingerprint
  const fingerprint = generateFingerprint();
  const userAgent = generateUserAgent(fingerprint.platform);

  // Configure chromium for serverless
  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  const executablePath = await chromium.executablePath();

  const launchOptions = {
    args: [
      ...chromium.args,
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
      `--window-size=${fingerprint.viewport.width},${fingerprint.viewport.height}`,
      `--lang=${fingerprint.locale}`,
    ],
    executablePath,
    headless: true, // Always headless on Vercel
  };

  // Add proxy if provided
  if (proxy) {
    launchOptions.proxy = parseProxyForPlaywright(proxy);
  }

  const browser = await playwright.launch(launchOptions);

  // Create context with fingerprint
  const context = await browser.newContext({
    userAgent,
    viewport: {
      width: fingerprint.viewport.width,
      height: fingerprint.viewport.height,
    },
    screen: {
      width: fingerprint.screen.width,
      height: fingerprint.screen.height,
    },
    locale: fingerprint.locale,
    timezoneId: fingerprint.timezone,
    colorScheme: 'light',
    deviceScaleFactor: [1, 1.25, 1.5, 2][Math.floor(Math.random() * 4)],
    hasTouch: fingerprint.maxTouchPoints > 0,
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
  });

  // Inject anti-detect scripts
  await context.addInitScript(generateInjectionScripts(fingerprint));
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  // Block tracking/analytics for speed
  await page.route('**/{analytics,tracking,pixel,beacon}**', route => route.abort());
  await page.route('**/google-analytics.com/**', route => route.abort());
  await page.route('**/googletagmanager.com/**', route => route.abort());

  return { browser, context, page, fingerprint };
}

/**
 * Parse proxy string for Playwright
 */
function parseProxyForPlaywright(proxyStr) {
  if (!proxyStr) return undefined;

  try {
    // If it's already a URL format
    if (proxyStr.includes('://')) {
      const url = new URL(proxyStr);
      const config = { server: `${url.protocol}//${url.hostname}:${url.port}` };
      if (url.username) {
        config.username = url.username;
        config.password = url.password;
      }
      return config;
    }

    // Simple host:port format
    const parts = proxyStr.split(':');
    if (parts.length >= 2) {
      return { server: `http://${parts[0]}:${parts[1]}` };
    }
  } catch (e) {}

  return undefined;
}
