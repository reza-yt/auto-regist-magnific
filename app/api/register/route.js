/**
 * API Route: /api/register
 * Handles full registration flow in a serverless function:
 * 1. Create temp email
 * 2. Register on magnific.ai
 * 3. Confirm email
 * 4. Extract API key
 *
 * Uses @sparticuz/chromium for Vercel serverless Chromium support
 */
import { NextResponse } from 'next/server';
import { createServerlessBrowser } from '@/lib/browser-serverless';
import { createMailProvider } from '@/lib/mail/index';
import { generatePassword, generateFirstName, generateLastName, sleep, randomDelay, extractVerificationUrl } from '@/lib/utils/helpers';

export const maxDuration = 300; // 5 minutes max (Vercel Pro)
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let browser = null;
  let page = null;
  let mailProvider = null;

  try {
    const body = await request.json();
    const { mailProvider: mailProviderName, proxy, headless = true } = body;

    // Step 1: Create temp email
    mailProvider = createMailProvider(mailProviderName || 'mail_tm');
    const account = await mailProvider.createAccount();

    if (!account || !account.email) {
      return NextResponse.json({ success: false, error: 'Failed to create temp email', step: 'email_creation' });
    }

    const email = account.email;
    const password = generatePassword(14);
    const firstName = generateFirstName();
    const lastName = generateLastName();

    // Step 2: Launch browser
    const browserResult = await createServerlessBrowser({ proxy, headless });
    browser = browserResult.browser;
    page = browserResult.page;

    // Step 3: Navigate to Magnific signup
    const signupUrls = [
      'https://magnific.ai/signup',
      'https://magnific.ai/register',
      'https://magnific.ai/api',
      'https://magnific.ai',
    ];

    let formFound = false;
    for (const url of signupUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);

        // Check for signup form or button
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
      return NextResponse.json({ success: false, error: 'Could not find signup form on magnific.ai', step: 'navigation' });
    }

    // Step 4: Fill registration form
    await fillForm(page, { email, password, firstName, lastName });

    // Step 5: Submit form
    await submitForm(page);
    await sleep(randomDelay(3000));

    // Step 6: Wait for verification email & confirm
    let verified = false;
    try {
      const verificationEmail = await mailProvider.waitForVerificationEmail({
        timeout: 150000,
        pollInterval: 5000,
      });

      if (verificationEmail) {
        const verifyUrl = extractVerificationUrl(verificationEmail.body);
        if (verifyUrl) {
          await page.goto(verifyUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await sleep(3000);
          verified = true;
        }
      }
    } catch (e) {
      // Verification might not be required for API key page
      verified = false;
    }

    // Step 7: Login and get API key
    let apiKey = null;
    try {
      // Try logging in
      await page.goto('https://magnific.ai/login', { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);

      const emailInput = await page.$('input[type="email"], input[name="email"]');
      if (emailInput) {
        await emailInput.fill(email);
        await sleep(500);
        const passInput = await page.$('input[type="password"]');
        if (passInput) {
          await passInput.fill(password);
          await sleep(500);
        }
        const submitBtn = await page.$('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
        if (submitBtn) {
          await submitBtn.click();
          await sleep(5000);
        }
      }

      // Navigate to API key page
      const apiUrls = ['https://magnific.ai/api', 'https://magnific.ai/api/keys', 'https://magnific.ai/dashboard/api', 'https://magnific.ai/settings/api'];
      for (const apiUrl of apiUrls) {
        try {
          await page.goto(apiUrl, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          apiKey = await extractApiKeyFromPage(page);
          if (apiKey) break;
        } catch (e) { continue; }
      }

      // Try generating a new key if not found
      if (!apiKey) {
        const genBtn = await page.$('button:has-text("Generate"), button:has-text("Create key"), button:has-text("Create API")');
        if (genBtn) {
          await genBtn.click();
          await sleep(3000);
          apiKey = await extractApiKeyFromPage(page);
        }
      }
    } catch (e) {
      // API key extraction failed
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
      error: error.message,
      step: 'unknown',
    });
  } finally {
    if (page) try { await page.close(); } catch (e) {}
    if (browser) try { await browser.close(); } catch (e) {}
    if (mailProvider) try { await mailProvider.deleteAccount(); } catch (e) {}
  }
}

/**
 * Fill registration form adaptively
 */
async function fillForm(page, { email, password, firstName, lastName }) {
  // Name fields
  const nameSelectors = ['input[name="firstName"]', 'input[name="first_name"]', 'input[placeholder*="first" i]'];
  for (const sel of nameSelectors) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(firstName); break; }
  }

  const lastNameSels = ['input[name="lastName"]', 'input[name="last_name"]', 'input[placeholder*="last" i]'];
  for (const sel of lastNameSels) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(lastName); break; }
  }

  const fullNameSels = ['input[name="name"]', 'input[name="fullName"]', 'input[placeholder*="name" i]:not([placeholder*="last"]):not([placeholder*="first"])'];
  for (const sel of fullNameSels) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(`${firstName} ${lastName}`); break; }
  }

  await sleep(500);

  // Email
  const emailSels = ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]'];
  for (const sel of emailSels) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(email); break; }
  }

  await sleep(500);

  // Password
  const passSels = ['input[type="password"]', 'input[name="password"]'];
  for (const sel of passSels) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(password); break; }
  }

  // Confirm password
  const confirmSels = ['input[name="confirmPassword"]', 'input[name="confirm_password"]', 'input[name="password_confirmation"]'];
  for (const sel of confirmSels) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) { await el.fill(password); break; }
  }

  // Terms checkbox
  const tosSels = ['input[type="checkbox"][name*="terms" i]', 'input[type="checkbox"][name*="agree" i]', 'input[type="checkbox"][id*="terms" i]'];
  for (const sel of tosSels) {
    const el = await page.$(sel);
    if (el) { try { await el.check(); } catch(e){} break; }
  }
}

/**
 * Submit registration form
 */
async function submitForm(page) {
  const submitSels = [
    'button[type="submit"]', 'button:has-text("Sign up")', 'button:has-text("Register")',
    'button:has-text("Create account")', 'button:has-text("Get started")', 'button:has-text("Continue")',
  ];
  for (const sel of submitSels) {
    const btn = await page.$(sel);
    if (btn && await btn.isVisible()) {
      await btn.click();
      return;
    }
  }
  await page.keyboard.press('Enter');
}

/**
 * Extract API key from current page
 */
async function extractApiKeyFromPage(page) {
  // Check readonly inputs, code blocks, etc
  const keySels = ['input[readonly]', '.api-key code', '.api-key span', '[data-testid*="api-key"]', 'code', 'pre'];
  for (const sel of keySels) {
    try {
      const els = await page.$$(sel);
      for (const el of els) {
        const value = (await el.getAttribute('value')) || (await el.textContent());
        if (value && looksLikeApiKey(value.trim())) return value.trim();
      }
    } catch (e) {}
  }

  // Check page content with regex
  const content = await page.content();
  const patterns = [
    /(?:api[_-]?key|token)['":\s]*['"]?([a-zA-Z0-9_-]{20,128})['"]?/gi,
    /(?:mk|mag|mf)[_-][a-zA-Z0-9]{20,64}/gi,
  ];
  for (const pattern of patterns) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      const key = (match[1] || match[0]).trim();
      if (looksLikeApiKey(key)) return key;
    }
  }

  return null;
}

function looksLikeApiKey(str) {
  if (!str || str.length < 20 || str.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(str);
}
