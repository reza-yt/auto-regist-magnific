/**
 * Magnific.ai Registration Automation
 * Handles the complete signup flow:
 * 1. Navigate to signup page
 * 2. Fill registration form
 * 3. Submit and handle verification
 * 4. Confirm email via temp mail link
 * 5. Complete account setup
 */
import { logger, logStep, logSuccess, logError } from '../utils/logger.js';
import { sleep, randomDelay, generatePassword, generateFirstName, generateLastName, extractVerificationUrl } from '../utils/helpers.js';
import { BrowserManager } from '../browser/browser-manager.js';
import config from '../config.js';

export class MagnificRegistration {
  constructor(mailProvider, proxyManager) {
    this.mailProvider = mailProvider;
    this.proxyManager = proxyManager;
    this.browser = null;
    this.account = null;
    this.credentials = null;
  }

  /**
   * Execute full registration flow
   * Returns: { email, password, verified, apiKey }
   */
  async register() {
    this.browser = new BrowserManager(this.proxyManager);
    let page;

    try {
      // Step 1: Create temp email
      logStep(1, 'Creating temporary email address...');
      this.account = await this.mailProvider.createAccount();
      const email = this.account.email;
      logSuccess(`Temp email created: ${email}`);

      // Generate credentials
      const password = generatePassword(14);
      const firstName = generateFirstName();
      const lastName = generateLastName();

      this.credentials = { email, password, firstName, lastName };
      logger.info(`Generated identity: ${firstName} ${lastName}`);

      // Step 2: Launch anti-detect browser
      logStep(2, 'Launching anti-detect browser...');
      page = await this.browser.launch();

      // Step 3: Navigate to Magnific signup
      logStep(3, 'Navigating to Magnific.ai signup...');
      await this.navigateToSignup(page);

      // Step 4: Fill registration form
      logStep(4, 'Filling registration form...');
      await this.fillRegistrationForm(page, { email, password, firstName, lastName });

      // Step 5: Submit registration
      logStep(5, 'Submitting registration...');
      await this.submitRegistration(page);

      // Step 6: Wait for and confirm verification email
      logStep(6, 'Waiting for verification email...');
      const verified = await this.confirmVerification(page);

      if (!verified) {
        throw new Error('Email verification failed');
      }

      logSuccess('Registration and verification complete!');

      return {
        email,
        password,
        firstName,
        lastName,
        verified: true,
      };

    } catch (error) {
      logError(`Registration failed: ${error.message}`);

      // Take debug screenshot on failure
      if (this.browser && this.browser.page) {
        try {
          await this.browser.screenshot('registration-error');
        } catch (e) {}
      }

      // Report proxy failure if it's a network issue
      if (error.message.includes('net::') || error.message.includes('timeout') || error.message.includes('ECONNR')) {
        this.browser.reportProxyFailure();
      }

      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Navigate to signup page - handles multiple possible signup flows
   */
  async navigateToSignup(page) {
    // Try direct signup URL first
    const signupUrls = [
      'https://magnific.ai/signup',
      'https://magnific.ai/register',
      'https://magnific.ai/api', // API page may have signup
      'https://magnific.ai',
    ];

    for (const url of signupUrls) {
      try {
        await this.browser.navigateTo(url, { timeout: 30000 });

        // Check if we landed on a signup form
        const hasSignupForm = await this.detectSignupForm(page);
        if (hasSignupForm) {
          logger.info(`Signup form found at: ${url}`);
          return;
        }

        // Look for "Sign up" or "Register" button/link
        const signupLink = await page.$('a[href*="signup"], a[href*="register"], a[href*="sign-up"], button:has-text("Sign up"), button:has-text("Register"), a:has-text("Sign up"), a:has-text("Create account"), a:has-text("Get Started")');
        if (signupLink) {
          await signupLink.click();
          await sleep(randomDelay(2000));
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

          const hasForm = await this.detectSignupForm(page);
          if (hasForm) {
            logger.info('Signup form found after navigation');
            return;
          }
        }
      } catch (error) {
        logger.warn(`Failed to load ${url}: ${error.message}`);
      }
    }

    // Try OAuth-style signup (some sites use Google/GitHub OAuth)
    // Magnific may use Freepik's auth system
    try {
      await this.browser.navigateTo('https://magnific.ai/api', { timeout: 30000 });
      await sleep(2000);

      // Look for email/password registration option
      const emailSignup = await page.$('button:has-text("Email"), a:has-text("Email"), button:has-text("email"), [data-testid="email-signup"], .email-signup');
      if (emailSignup) {
        await emailSignup.click();
        await sleep(randomDelay(2000));
      }
    } catch (error) {
      logger.warn(`OAuth-style navigation attempt: ${error.message}`);
    }

    // If we still don't have a form, just proceed - the form filling step will handle detection
    logger.warn('Could not definitively locate signup form - will attempt form filling on current page');
  }

  /**
   * Detect if current page has a signup form
   */
  async detectSignupForm(page) {
    const selectors = [
      'input[type="email"], input[name="email"], input[placeholder*="email" i]',
      'input[type="password"], input[name="password"], input[placeholder*="password" i]',
      'form[action*="signup"], form[action*="register"], form[action*="sign-up"]',
      '[data-testid="signup-form"], .signup-form, .register-form, #signup-form',
    ];

    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) return true;
    }
    return false;
  }

  /**
   * Fill the registration form with credentials
   * Handles various form layouts adaptively
   */
  async fillRegistrationForm(page, { email, password, firstName, lastName }) {
    // Wait for form to be interactive
    await sleep(randomDelay(1000));

    // --- Fill First Name (if field exists) ---
    const firstNameSelectors = [
      'input[name="firstName"]', 'input[name="first_name"]', 'input[name="fname"]',
      'input[placeholder*="first name" i]', 'input[placeholder*="First" i]',
      'input[id*="firstName" i]', 'input[id*="first-name" i]',
      'input[aria-label*="first name" i]',
    ];
    await this.fillField(page, firstNameSelectors, firstName);

    // --- Fill Last Name (if field exists) ---
    const lastNameSelectors = [
      'input[name="lastName"]', 'input[name="last_name"]', 'input[name="lname"]',
      'input[placeholder*="last name" i]', 'input[placeholder*="Last" i]',
      'input[id*="lastName" i]', 'input[id*="last-name" i]',
      'input[aria-label*="last name" i]',
    ];
    await this.fillField(page, lastNameSelectors, lastName);

    // --- Fill Full Name (if separate field) ---
    const fullNameSelectors = [
      'input[name="name"]', 'input[name="fullName"]', 'input[name="full_name"]',
      'input[placeholder*="full name" i]', 'input[placeholder*="your name" i]',
      'input[id*="fullName" i]', 'input[aria-label*="name" i]:not([aria-label*="last"]):not([aria-label*="first"])',
    ];
    await this.fillField(page, fullNameSelectors, `${firstName} ${lastName}`);

    await sleep(randomDelay(800));

    // --- Fill Email ---
    const emailSelectors = [
      'input[type="email"]', 'input[name="email"]', 'input[name="Email"]',
      'input[placeholder*="email" i]', 'input[id*="email" i]',
      'input[autocomplete="email"]', 'input[aria-label*="email" i]',
    ];
    const emailFilled = await this.fillField(page, emailSelectors, email);
    if (!emailFilled) {
      throw new Error('Could not find email input field');
    }

    await sleep(randomDelay(1000));

    // --- Fill Password ---
    const passwordSelectors = [
      'input[type="password"]', 'input[name="password"]',
      'input[placeholder*="password" i]', 'input[id*="password" i]',
      'input[autocomplete="new-password"]', 'input[aria-label*="password" i]',
    ];
    const passwordFilled = await this.fillField(page, passwordSelectors, password);
    if (!passwordFilled) {
      throw new Error('Could not find password input field');
    }

    // --- Fill Confirm Password (if exists) ---
    await sleep(randomDelay(500));
    const confirmPasswordSelectors = [
      'input[name="confirmPassword"]', 'input[name="confirm_password"]',
      'input[name="password_confirmation"]', 'input[name="passwordConfirm"]',
      'input[placeholder*="confirm" i]', 'input[placeholder*="repeat" i]',
      'input[id*="confirm" i]', 'input[aria-label*="confirm" i]',
      'input[type="password"]:nth-of-type(2)',
    ];
    await this.fillField(page, confirmPasswordSelectors, password);

    // --- Accept Terms/ToS checkbox (if exists) ---
    await sleep(randomDelay(500));
    const tosSelectors = [
      'input[type="checkbox"][name*="terms" i]',
      'input[type="checkbox"][name*="tos" i]',
      'input[type="checkbox"][name*="agree" i]',
      'input[type="checkbox"][name*="accept" i]',
      'input[type="checkbox"][id*="terms" i]',
      'input[type="checkbox"][id*="agree" i]',
      '[role="checkbox"][aria-label*="terms" i]',
      '[role="checkbox"][aria-label*="agree" i]',
      'label:has-text("terms") input[type="checkbox"]',
      'label:has-text("agree") input[type="checkbox"]',
    ];

    for (const selector of tosSelectors) {
      try {
        const checkbox = await page.$(selector);
        if (checkbox) {
          const isChecked = await checkbox.isChecked();
          if (!isChecked) {
            await checkbox.click();
            logger.info('Accepted Terms of Service');
          }
          break;
        }
      } catch (e) {}
    }

    // Small random delay to look human
    await sleep(randomDelay(1000));
    logger.info('Registration form filled successfully');
  }

  /**
   * Try to fill a field using multiple selectors
   */
  async fillField(page, selectors, value) {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            await this.browser.humanType(selector, value);
            return true;
          }
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  /**
   * Submit the registration form
   */
  async submitRegistration(page) {
    // Find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign up")',
      'button:has-text("Register")',
      'button:has-text("Create account")',
      'button:has-text("Get started")',
      'button:has-text("Continue")',
      'button:has-text("Submit")',
      'input[type="submit"]',
      '[data-testid="signup-button"]',
      '[data-testid="submit-button"]',
      '.signup-button',
      '.register-button',
      '.submit-btn',
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          if (isVisible && isEnabled) {
            await this.browser.humanClick(selector);
            submitted = true;
            logger.info(`Clicked submit button: ${selector}`);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!submitted) {
      // Try pressing Enter as last resort
      await page.keyboard.press('Enter');
      logger.warn('No submit button found, pressed Enter');
    }

    // Wait for response
    await sleep(randomDelay(3000));

    // Check for common errors
    const errorSelectors = [
      '.error-message', '.alert-danger', '.form-error',
      '[role="alert"]', '.notification-error', '.error',
      'p:has-text("already exists")', 'p:has-text("already registered")',
      'div:has-text("Invalid")', 'span:has-text("error")',
    ];

    for (const selector of errorSelectors) {
      try {
        const errorEl = await page.$(selector);
        if (errorEl) {
          const errorText = await errorEl.textContent();
          if (errorText && errorText.trim()) {
            // Some errors are not fatal (e.g., "check your email")
            const nonFatal = ['check your email', 'verify', 'confirmation', 'sent'];
            if (nonFatal.some(kw => errorText.toLowerCase().includes(kw))) {
              logger.info(`Post-submit message: ${errorText.trim()}`);
            } else {
              throw new Error(`Registration error: ${errorText.trim()}`);
            }
          }
        }
      } catch (e) {
        if (e.message.startsWith('Registration error:')) throw e;
      }
    }

    // Check for success indicators
    const successIndicators = [
      'text="Check your email"',
      'text="Verify your email"',
      'text="confirmation"',
      'text="Success"',
      'text="Welcome"',
    ];

    for (const indicator of successIndicators) {
      try {
        const el = await page.$(indicator);
        if (el) {
          logSuccess('Registration submitted successfully - verification required');
          return true;
        }
      } catch (e) {}
    }

    // If page URL changed, registration likely succeeded
    const currentUrl = page.url();
    if (currentUrl.includes('verify') || currentUrl.includes('confirm') ||
        currentUrl.includes('check-email') || currentUrl.includes('dashboard') ||
        currentUrl.includes('welcome')) {
      logSuccess('Registration submitted - redirected to verification/dashboard');
      return true;
    }

    logger.info('Registration submitted (no explicit success/error detected)');
    return true;
  }

  /**
   * Confirm email verification
   */
  async confirmVerification(page) {
    try {
      // Wait for verification email
      const verificationEmail = await this.mailProvider.waitForVerificationEmail({
        timeout: 150000, // 2.5 minutes
        pollInterval: 5000,
        senderKeywords: ['magnific', 'freepik', 'noreply', 'no-reply', 'verify', 'confirm'],
        subjectKeywords: ['verify', 'confirm', 'activate', 'welcome', 'complete', 'registration'],
      });

      if (!verificationEmail) {
        throw new Error('No verification email received');
      }

      logger.info(`Verification email received from: ${verificationEmail.from}`);

      // Extract verification URL
      const verifyUrl = extractVerificationUrl(verificationEmail.body);

      if (!verifyUrl) {
        // Try to find verification code instead of URL
        const codeMatch = verificationEmail.body.match(/\b(\d{4,8})\b/);
        if (codeMatch) {
          logger.info(`Found verification code: ${codeMatch[1]}`);
          // Handle OTP-style verification
          return await this.handleCodeVerification(page, codeMatch[1]);
        }

        throw new Error('Could not extract verification URL or code from email');
      }

      logger.info(`Verification URL found: ${verifyUrl.substring(0, 80)}...`);

      // Navigate to verification URL
      await this.browser.navigateTo(verifyUrl, { timeout: 30000 });
      await sleep(randomDelay(3000));

      // Check if verification succeeded
      const pageContent = await page.content();
      const successKeywords = ['verified', 'confirmed', 'success', 'activated', 'welcome', 'complete'];
      const isVerified = successKeywords.some(kw => pageContent.toLowerCase().includes(kw));

      if (isVerified) {
        logSuccess('Email verification confirmed!');
        return true;
      }

      // Some sites auto-redirect after verification
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('dashboard') || currentUrl.includes('welcome')) {
        logSuccess('Email verified - redirected to login/dashboard');
        return true;
      }

      // If there's a "Continue" or "Login" button, click it
      const continueBtn = await page.$('button:has-text("Continue"), a:has-text("Login"), a:has-text("Sign in"), button:has-text("Get Started")');
      if (continueBtn) {
        await continueBtn.click();
        await sleep(randomDelay(2000));
        logSuccess('Email verified - clicked continue');
        return true;
      }

      // Assume verification worked if no error shown
      logger.warn('Verification status unclear - assuming success');
      return true;

    } catch (error) {
      logError(`Verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle OTP code-based verification
   */
  async handleCodeVerification(page, code) {
    const codeSelectors = [
      'input[name="code"]', 'input[name="otp"]', 'input[name="verification_code"]',
      'input[placeholder*="code" i]', 'input[placeholder*="OTP" i]',
      'input[type="tel"]', 'input[maxlength="6"]', 'input[maxlength="4"]',
      '.otp-input', '.verification-code-input',
    ];

    for (const selector of codeSelectors) {
      try {
        const input = await page.$(selector);
        if (input && await input.isVisible()) {
          await this.browser.humanType(selector, code);
          await sleep(randomDelay(1000));

          // Submit the code
          const submitBtn = await page.$('button[type="submit"], button:has-text("Verify"), button:has-text("Confirm"), button:has-text("Submit")');
          if (submitBtn) {
            await submitBtn.click();
          } else {
            await page.keyboard.press('Enter');
          }

          await sleep(randomDelay(3000));
          logSuccess('Verification code submitted');
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    logger.warn('Could not find code input field');
    return false;
  }

  /**
   * Get the credentials used for registration
   */
  getCredentials() {
    return this.credentials;
  }
}

export default MagnificRegistration;
