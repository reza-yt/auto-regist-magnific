#!/usr/bin/env node
/**
 * Magnific.ai Auto Registration Tool
 * ====================================
 * Main entry point - orchestrates the full workflow:
 * 1. Create temp email
 * 2. Register on magnific.ai with anti-detect browser
 * 3. Confirm email verification
 * 4. Login and extract API key
 * 5. Save credentials and API key to file
 *
 * Usage:
 *   node src/index.js                    # Single registration
 *   node src/index.js --mode=batch --count=5  # Batch mode
 *   node src/index.js --help
 */
import { Command } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import PQueue from 'p-queue';
import { logger, logSuccess, logError, logInfo, logStep } from './utils/logger.js';
import { sleep, randomDelay, retry } from './utils/helpers.js';
import { createMailProvider, createMailWithFallback } from './mail/index.js';
import { createProxyManager } from './proxy/index.js';
import { MagnificRegistration } from './registration/register.js';
import { ApiKeyExtractor } from './registration/api-key-extractor.js';
import config from './config.js';

// Ensure log directories exist
const logDir = join(config.rootDir, 'logs', 'screenshots');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

/**
 * Single account registration + API key extraction
 */
async function registerSingleAccount(proxyManager, accountNumber = 1) {
  const startTime = Date.now();
  logInfo(`\n${'═'.repeat(60)}`);
  logInfo(`Starting registration #${accountNumber}`);
  logInfo(`${'═'.repeat(60)}`);

  let mailProvider = null;
  let result = null;

  try {
    // Create mail provider with fallback
    const proxyAgent = proxyManager.hasProxies() ? proxyManager.createAgent() : null;
    const { provider, account } = await createMailWithFallback(proxyAgent);
    mailProvider = provider;

    // Register account
    const registration = new MagnificRegistration(mailProvider, proxyManager);
    const regResult = await registration.register();

    if (!regResult || !regResult.verified) {
      throw new Error('Registration or verification failed');
    }

    logSuccess(`Account registered: ${regResult.email}`);

    // Wait a bit before API key extraction (avoid rate limiting)
    const cooldown = randomDelay(5000);
    logInfo(`Waiting ${Math.round(cooldown/1000)}s before API key extraction...`);
    await sleep(cooldown);

    // Extract API key
    const extractor = new ApiKeyExtractor(proxyManager);
    result = await retry(async () => {
      return await extractor.extractApiKey({
        email: regResult.email,
        password: regResult.password,
      });
    }, config.maxRetries, 10000);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logSuccess(`\n✓ Account #${accountNumber} complete in ${duration}s`);
    logSuccess(`  Email: ${result.email}`);
    logSuccess(`  API Key: ${result.apiKey.substring(0, 12)}...`);

    return result;

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logError(`\n✗ Account #${accountNumber} failed after ${duration}s: ${error.message}`);
    return null;
  } finally {
    // Cleanup temp mail
    if (mailProvider) {
      try {
        await mailProvider.deleteAccount();
      } catch (e) {}
    }
  }
}

/**
 * Batch registration mode
 */
async function batchRegister(count, concurrency = 1) {
  logInfo(`\n${'═'.repeat(60)}`);
  logInfo(`  MAGNIFIC.AI AUTO REGISTRATION - BATCH MODE`);
  logInfo(`  Accounts to create: ${count}`);
  logInfo(`  Concurrency: ${concurrency}`);
  logInfo(`${'═'.repeat(60)}\n`);

  const proxyManager = createProxyManager();

  if (proxyManager.hasProxies()) {
    const stats = proxyManager.getStats();
    logInfo(`Proxies loaded: ${stats.total} (${stats.available} available)`);
  } else {
    logInfo('⚠ No proxies configured - running without proxy');
  }

  const queue = new PQueue({ concurrency });
  const results = { success: 0, failed: 0, apiKeys: [] };

  const tasks = [];
  for (let i = 1; i <= count; i++) {
    tasks.push(
      queue.add(async () => {
        const result = await registerSingleAccount(proxyManager, i);
        if (result) {
          results.success++;
          results.apiKeys.push(result);
        } else {
          results.failed++;
        }

        // Delay between registrations
        if (i < count) {
          const delay = randomDelay(config.registrationDelay);
          logInfo(`Waiting ${Math.round(delay/1000)}s before next registration...`);
          await sleep(delay);
        }
      })
    );
  }

  await Promise.all(tasks);

  // Print summary
  logInfo(`\n${'═'.repeat(60)}`);
  logInfo(`  BATCH REGISTRATION COMPLETE`);
  logInfo(`${'═'.repeat(60)}`);
  logSuccess(`  Successful: ${results.success}/${count}`);
  if (results.failed > 0) {
    logError(`  Failed: ${results.failed}/${count}`);
  }
  logInfo(`  API Keys saved to: ${config.outputFile}`);
  logInfo(`${'═'.repeat(60)}\n`);

  if (proxyManager.hasProxies()) {
    const stats = proxyManager.getStats();
    logInfo(`Proxy stats: ${stats.blacklisted} blacklisted out of ${stats.total}`);
  }

  return results;
}

/**
 * CLI Setup
 */
const program = new Command();

program
  .name('magnific-auto-regist')
  .description('Auto registration tool for magnific.ai with API key extraction')
  .version('1.0.0');

program
  .option('-m, --mode <mode>', 'Mode: register (single) or batch', 'register')
  .option('-c, --count <number>', 'Number of accounts for batch mode', '5')
  .option('--concurrency <number>', 'Concurrent registrations', '1')
  .option('--provider <name>', 'Temp mail provider: mail_tm, guerrilla, kopeechka', '')
  .option('--proxy <url>', 'Single proxy URL to use', '')
  .option('--headless', 'Run in headless mode (default)', true)
  .option('--no-headless', 'Run with visible browser')
  .option('--output <file>', 'Output file for API keys', '')
  .action(async (options) => {
    try {
      // Override config with CLI options
      if (options.provider) config.tempMailProvider = options.provider;
      if (options.proxy) {
        config.proxyMode = 'single';
        config.proxyUrl = options.proxy;
      }
      if (options.output) config.outputFile = options.output;
      if (options.headless === false) config.headless = false;

      const mode = options.mode.toLowerCase();

      if (mode === 'batch') {
        const count = parseInt(options.count, 10);
        const concurrency = parseInt(options.concurrency, 10);
        await batchRegister(count, concurrency);
      } else {
        // Single registration
        logInfo(`\n${'═'.repeat(60)}`);
        logInfo(`  MAGNIFIC.AI AUTO REGISTRATION - SINGLE MODE`);
        logInfo(`${'═'.repeat(60)}\n`);

        const proxyManager = createProxyManager();
        const result = await registerSingleAccount(proxyManager, 1);

        if (result) {
          logSuccess('\n✓ Registration and API key extraction complete!');
          logSuccess(`  Output: ${config.outputFile}`);
        } else {
          logError('\n✗ Registration failed. Check logs for details.');
          process.exit(1);
        }
      }
    } catch (error) {
      logError(`Fatal error: ${error.message}`);
      logger.error(error.stack);
      process.exit(1);
    }
  });

program.parse();
