import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Load .env file
const envPath = join(ROOT_DIR, '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: join(ROOT_DIR, '.env.example') });
}

export const config = {
  // Proxy
  proxyMode: process.env.PROXY_MODE || 'none',
  proxyUrl: process.env.PROXY_URL || '',
  rotatingProxyUrl: process.env.ROTATING_PROXY_URL || '',
  proxyListFile: join(ROOT_DIR, 'proxies.txt'),

  // Temp Mail
  tempMailProvider: process.env.TEMP_MAIL_PROVIDER || 'mail_tm',
  kopeechkaApiKey: process.env.KOPEECHKA_API_KEY || '',

  // Registration
  batchCount: parseInt(process.env.BATCH_COUNT || '5', 10),
  registrationDelay: parseInt(process.env.REGISTRATION_DELAY || '15000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),

  // Browser
  headless: process.env.HEADLESS !== 'false',
  minWidth: parseInt(process.env.MIN_WIDTH || '1280', 10),
  maxWidth: parseInt(process.env.MAX_WIDTH || '1920', 10),
  minHeight: parseInt(process.env.MIN_HEIGHT || '720', 10),
  maxHeight: parseInt(process.env.MAX_HEIGHT || '1080', 10),

  // Output
  outputFile: join(ROOT_DIR, process.env.OUTPUT_FILE || 'api_keys.txt'),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Anti-Detect
  webglVendor: process.env.WEBGL_VENDOR || 'Google Inc.',
  canvasNoise: process.env.CANVAS_NOISE !== 'false',
  audioSpoof: process.env.AUDIO_SPOOF !== 'false',

  // URLs
  magnific: {
    baseUrl: 'https://magnific.ai',
    signupUrl: 'https://magnific.ai/signup',
    loginUrl: 'https://magnific.ai/login',
    apiPageUrl: 'https://magnific.ai/api',
    dashboardUrl: 'https://magnific.ai/dashboard',
  },

  // Paths
  rootDir: ROOT_DIR,
};

export default config;
