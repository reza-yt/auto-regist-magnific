/**
 * API Route: /api/register
 * Full registration flow as serverless function
 * Requires Vercel Pro plan (300s timeout, 3GB memory)
 */
import { NextResponse } from 'next/server';
import { createMailProvider } from '@/lib/mail/index';
import { generatePassword, generateFirstName, generateLastName, sleep, randomDelay, extractVerificationUrl } from '@/lib/utils/helpers';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let browser = null;
  let page = null;
  let mailProvider = null;
  let currentStep = 'init';

  try {
    const body = await request.json();
    const { mailProvider: mailProviderName, proxy, headless = true } = body;

    // Step 1: Create temp email
    currentStep = 'email_creation';
    mailProvider = createMailProvider(mailProviderName || 'mail_tm');
    const account = await mailProvider.createAccount();

    if (!account || !account.email) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create temp email. Try different provider.',
        step: currentStep,
      });
    }

    const email = account.email;
    const password = generatePassword(14);
    const firstName = generateFirstName();
    const lastName = generateLastName();

    // Step 2: Launch browser
    currentStep = 'browser_launch';
    let createServerlessBrowser;
    try {
      const browserModule = await import('@/lib/browser-serverless');
      createServerlessBrowser = browserModule.createServerlessBrowser;
    } catch (importErr) {
      return NextResponse.json({
        success: false,
        error: `Browser module import failed: ${importErr.message}`,
        step: currentStep,
      });
    }

    const browserResult = await createServerlessBrowser({ proxy, headless });
    browser = browserResult.browser;
    page = browserResult.page;

    // Step 3: Navigate to Magnific signup
    currentStep = 'navigation';
    const signupUrls = [
      'https://magnific.ai/signup',
      'https://magnific.ai/register',
      'https://magnific.ai/api',
      'https://magnific.ai',
    ];

    let formFound = false;
    for (const url of signupUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);

        // Check for signup form
        const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
        if (emailInput) { formFound = true; break; }

        // Click signup link if exists
        const signupBtn = await page.$('a:has-text("Sign up"), button:has-text("Sign up"), a:has-text("Get Started"), a:has-text("Create account")');
        if (signupBtn) {
          await signupBtn.click();
          await sleep(3000);
          const emailAfter = await page.$('input[type="email"], input[name="email"]');
          if (emailAfter) { formFound = true; break; }
        }
      } catch (e) {
        continue;
      }
    }

    if (!formFound) {
      // Get current page info for debugging
      const currentUrl = page.url();
      const title = await page.title();
      return NextResponse.json({
        success: false,
        error: `Could not find signup form. Current page: ${currentUrl} (${title})`,
        step: currentStep,
      });
    }

    // Step 4: Fill registration form
    currentStep = 'form_filling';
    await fillForm(page, { email, password, firstName, lastName });

    // Step 5: Submit form
    currentStep = 'form_submit';
    await submitForm(page);
    await sleep(randomDelay(4000));

    // Step 6: Wait for verification email & confirm
    currentStep = 'email_verification';
    let verified = false;
    try {
      const verificationEmail = await mailProvider.waitForVerificationEmail({
        timeout: 120000,
        pollInterval: 5000,
      });

      if (verificationEmail) {
        const verifyUrl = extractVerificationUrl(verificationEmail.body);
        if (verifyUrl) {
          await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(3000);
          verified = true;
        }
      }
    } catch (e) {
      // Verification timeout - might still be ok
      verified = false;
    }

    // Step 7: Login and get API key
    currentStep = 'api_key_extraction';
    let apiKey = null;
    try {
      await page.goto('https://magnific.ai/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);

      const emailInput = await page.$('input[type="email"], input[name="email"]');
      if (emailInput) {
        await emailInput.fill(email);
        await sleep(500);
        const passInput = await page.$('input[type="password"]');
        if (passInput) await passInput.fill(password);
        await sleep(500);

        const submitBtn = await page.$('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
        if (submitBtn) {
          await submitBtn.click();
          await sleep(5000);
        }
      }

      // Navigate to API key pages
      const apiUrls = ['https://magnific.ai/api', 'https://magnific.ai/api/keys', 'https://magnific.ai/dashboard/api'];
      for (const apiUrl of apiUrls) {
        try {
          await page.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await sleep(2000);
          apiKey = await extractApiKeyFromPage(page);
          if (apiKey) break;
        } catch (e) { continue; }
      }

      // Try generating a new key
      if (!apiKey) {
        const genBtn = await page.$('button:has-text("Generate"), button:has-text("Create key"), button:has-text("Create API")');
        if (genBtn) {
          await genBtn.click();
          await sleep(3000);
          apiKey = await extractApiKeyFromPage(page);
        }
      }
    } catch (e) {
      // API key extraction failed - still return account info
    }

    return NextResponse.json({
      success: true,
      email,
      password,
      firstName,
      lastName,
      verified,
      apiKey: apiKey || 'extraction_pending',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `[${currentStep}] ${error.message}`,
      step: currentStep,
      details: error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : undefined,
    });
  } finally {
    try { if (page) await page.close(); } catch (e) {}
    try { if (browser) await browser.close(); } catch (e) {}
    try { if (mailProvider) await mailProvider.deleteAccount(); } catch (e) {}
  }
}

async function fillForm(page, { email, password, firstName, lastName }) {
  const tryFill = async (selectors, value) => {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) { await el.fill(value); return true; }
      } catch (e) {}
    }
    return false;
  };

  await tryFill(['input[name="firstName"]', 'input[name="first_name"]', 'input[placeholder*="first" i]'], firstName);
  await tryFill(['input[name="lastName"]', 'input[name="last_name"]', 'input[placeholder*="last" i]'], lastName);
  await tryFill(['input[name="name"]', 'input[name="fullName"]', 'input[placeholder*="your name" i]'], `${firstName} ${lastName}`);
  await sleep(300);
  await tryFill(['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]'], email);
  await sleep(300);
  await tryFill(['input[type="password"]', 'input[name="password"]'], password);
  await tryFill(['input[name="confirmPassword"]', 'input[name="confirm_password"]', 'input[name="password_confirmation"]'], password);

  // Accept terms
  const tosSels = ['input[type="checkbox"][name*="terms" i]', 'input[type="checkbox"][name*="agree" i]'];
  for (const sel of tosSels) {
    try { const el = await page.$(sel); if (el) await el.check(); break; } catch(e) {}
  }
}

async function submitForm(page) {
  const sels = [
    'button[type="submit"]', 'button:has-text("Sign up")', 'button:has-text("Register")',
    'button:has-text("Create account")', 'button:has-text("Get started")', 'button:has-text("Continue")',
  ];
  for (const sel of sels) {
    try {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) { await btn.click(); return; }
    } catch (e) {}
  }
  await page.keyboard.press('Enter');
}

async function extractApiKeyFromPage(page) {
  const keySels = ['input[readonly]', '.api-key code', '[data-testid*="api-key"]', 'code', 'pre'];
  for (const sel of keySels) {
    try {
      const els = await page.$$(sel);
      for (const el of els) {
        const value = (await el.getAttribute('value')) || (await el.textContent());
        if (value && value.trim().length >= 20 && /^[a-zA-Z0-9_-]+$/.test(value.trim())) {
          return value.trim();
        }
      }
    } catch (e) {}
  }

  try {
    const content = await page.content();
    const patterns = [
      /(?:api[_-]?key|token)['":\s]*['"]?([a-zA-Z0-9_-]{20,128})['"]?/gi,
      /(?:mk|mag|mf)[_-][a-zA-Z0-9]{20,64}/gi,
    ];
    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const key = (match[1] || match[0]).trim();
        if (key.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(key)) return key;
      }
    }
  } catch (e) {}

  return null;
}
