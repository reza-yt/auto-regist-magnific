/**
 * Serverless Browser Manager
 * Uses playwright-core + @sparticuz/chromium for Vercel deployment
 * Falls back gracefully if chromium is not available
 */
import { generateFingerprint, generateInjectionScripts, generateUserAgent } from './browser/fingerprint';

/**
 * Create a browser instance optimized for serverless environment
 */
export async function createServerlessBrowser(options = {}) {
  const { proxy = null, headless = true } = options;

  // Generate unique fingerprint
  const fingerprint = generateFingerprint();
  const userAgent = generateUserAgent(fingerprint.platform);

  // Dynamic imports for serverless compatibility
  let chromiumModule;
  let playwrightModule;

  try {
    chromiumModule = (await import('@sparticuz/chromium')).default;
  } catch (e) {
    throw new Error(
      'Browser runtime not available. @sparticuz/chromium is required for Vercel deployment. ' +
      'Make sure it is installed: npm install @sparticuz/chromium'
    );
  }

  try {
    playwrightModule = await import('playwright-core');
  } catch (e) {
    throw new Error('playwright-core is required. Install it: npm install playwright-core');
  }

  const playwright = playwrightModule.chromium;

  // Configure chromium for serverless
  chromiumModule.setHeadlessMode = true;
  chromiumModule.setGraphicsMode = false;

  const executablePath = await chromiumModule.executablePath();

  const launchOptions = {
    args: [
      ...chromiumModule.args,
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
    const proxyConfig = parseProxyForPlaywright(proxy);
    if (proxyConfig) {
      launchOptions.proxy = proxyConfig;
    }
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
        config.username = decodeURIComponent(url.username);
        config.password = decodeURIComponent(url.password);
      }
      return config;
    }

    // Simple host:port format
    const parts = proxyStr.split(':');
    if (parts.length >= 2) {
      return { server: `http://${parts[0]}:${parts[1]}` };
    }
  } catch (e) {
    console.error('Failed to parse proxy:', proxyStr, e.message);
  }

  return undefined;
}
