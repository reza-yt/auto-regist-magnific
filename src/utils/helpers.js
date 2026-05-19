import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Generate a random delay with jitter
 */
export function randomDelay(baseMs, jitterPercent = 0.3) {
  const jitter = baseMs * jitterPercent;
  const min = baseMs - jitter;
  const max = baseMs + jitter;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random password
 */
export function generatePassword(length = 16) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  let password = '';
  // Ensure at least one of each type
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generate random first name
 */
export function generateFirstName() {
  const names = [
    'James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Joseph',
    'Thomas', 'Christopher', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark',
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan',
    'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra',
    'Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Cameron', 'Avery',
    'Quinn', 'Blake', 'Hayden', 'Emerson', 'Rowan', 'Finley', 'Sage', 'Phoenix'
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Generate random last name
 */
export function generateLastName() {
  const names = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
    'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Generate a random username from email
 */
export function generateUsername() {
  const adjectives = ['quick', 'bright', 'cool', 'smart', 'fast', 'keen', 'bold', 'calm'];
  const nouns = ['wolf', 'hawk', 'bear', 'lion', 'fox', 'eagle', 'shark', 'tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${adj}${noun}${num}`;
}

/**
 * Extract verification URL from email HTML/text
 */
export function extractVerificationUrl(emailBody, domain = 'magnific') {
  // Try multiple patterns for verification links
  const patterns = [
    /https?:\/\/[^\s"'<>]*(?:verify|confirm|activate|validation)[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*(?:token|code|key)=[^\s"'<>]*/gi,
    /href=["'](https?:\/\/[^"']*(?:verify|confirm|activate)[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*magnific[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*freepik[^"']*)["']/gi,
  ];

  for (const pattern of patterns) {
    const matches = emailBody.matchAll(pattern);
    for (const match of matches) {
      const url = match[1] || match[0];
      if (url.includes(domain) || url.includes('magnific') || url.includes('freepik')) {
        return url;
      }
    }
  }

  // Fallback: find any link with common verification keywords
  const allLinks = emailBody.match(/https?:\/\/[^\s"'<>]+/g) || [];
  for (const link of allLinks) {
    if (link.includes('verify') || link.includes('confirm') || link.includes('activate')) {
      return link;
    }
  }

  // Last resort: find any magnific/freepik link
  for (const link of allLinks) {
    if (link.includes('magnific') || link.includes('freepik')) {
      return link;
    }
  }

  return null;
}

/**
 * Generate random hex color (for canvas fingerprint)
 */
export function randomHexColor() {
  return '#' + crypto.randomBytes(3).toString('hex');
}

/**
 * Get a random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Retry an async function with exponential backoff
 */
export async function retry(fn, maxRetries = 3, baseDelay = 2000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
