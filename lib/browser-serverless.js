/**
 * Serverless Browser Manager
 * Proven working configuration for Vercel serverless functions
 * Uses playwright-core + @sparticuz/chromium
 */
import { generateFingerprint, generateInjectionScripts, generateUserAgent } from './browser/fingerprint';

/**
 * Create a browser instance optimized for Vercel serverless
 */
export async function createServerlessBrowser(options = {}) {
  const { proxy = null } = options;

  // Generate unique fingerprint for this session
  const fingerprint = generateFingerprint();
  const userAgent = generateUserAgent(fingerprint.platform);

  // Dynamic imports - required for Vercel bundling
  const chromium = (await import('@sparticuz/chromium')).default;
  const { chromium: playwright } = await import('playwright-core');

  // CRITICAL: Vercel-specific chromium configuration
  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  // Get the executable path for the serverless chromium binary
  const executablePath = await chromium.executablePath(
    'https://github.com/nicholasgasior/chromium-builds/releases/download/v126.0.0/chromium-v126.0.0-pack.tar'
  );

  // Minimal stable args for Vercel (don't overload with too many flags)
  const launchArgs = [
    ...chromium.args,
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    `--window-size=${fingerprint.viewport.width},${fingerprint.viewport.height}`,
  ];

  // Build launch options
  const launchOptions = {
    args: launchArgs,
    executablePath,
    headless: chromium.headless,
  };

  // Add proxy if provided
  if (proxy) {
    const proxyConfig = parseProxyForPlaywright(proxy);
    if (proxyConfig) {
      launchOptions.proxy = proxyConfig;
    }
  }

  // Launch browser
  const browser = await playwright.launch(launchOptions);

  // Create browser context with fingerprint
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
    deviceScaleFactor: 1,
    hasTouch: false,
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
  });

  // Inject anti-detect fingerprint scripts
  await context.addInitScript(generateInjectionScripts(fingerprint));

  // Create page
  const page = await context.newPage();

  // Block heavy resources to save memory and speed up
  await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}', (route) => {
    const url = route.request().url();
    // Allow images on magnific/freepik (might need for CAPTCHA)
    if (url.includes('magnific') || url.includes('freepik')) {
      return route.continue();
    }
    return route.abort();
  });

  // Block analytics/tracking
  await page.route('**/google-analytics.com/**', route => route.abort());
  await page.route('**/googletagmanager.com/**', route => route.abort());
  await page.route('**/facebook.com/tr/**', route => route.abort());
  await page.route('**/hotjar.com/**', route => route.abort());

  return { browser, context, page, fingerprint };
}

/**
 * Parse proxy string for Playwright format
 */
function parseProxyForPlaywright(proxyStr) {
  if (!proxyStr) return undefined;

  try {
    if (proxyStr.includes('://')) {
      const url = new URL(proxyStr);
      const config = { server: `${url.protocol}//${url.hostname}:${url.port}` };
      if (url.username) {
        config.username = decodeURIComponent(url.username);
        config.password = decodeURIComponent(url.password);
      }
      return config;
    }

    // host:port format
    const parts = proxyStr.split(':');
    if (parts.length === 2) {
      return { server: `http://${parts[0]}:${parts[1]}` };
    }
    if (parts.length === 4) {
      // host:port:user:pass
      return {
        server: `http://${parts[0]}:${parts[1]}`,
        username: parts[2],
        password: parts[3],
      };
    }
  } catch (e) {
    console.error('[Browser] Failed to parse proxy:', e.message);
  }

  return undefined;
}
