/**
 * Utility functions (Serverless version)
 */

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomDelay(baseMs, jitter = 0.3) {
  const j = baseMs * jitter;
  return Math.floor(Math.random() * (2 * j)) + (baseMs - j);
}

export function generatePassword(length = 14) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  let pw = '';
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = pw.length; i < length; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export function generateFirstName() {
  const names = ['James', 'Robert', 'John', 'Michael', 'David', 'William', 'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Mary', 'Jennifer', 'Linda', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan'];
  return names[Math.floor(Math.random() * names.length)];
}

export function generateLastName() {
  const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'Harris'];
  return names[Math.floor(Math.random() * names.length)];
}

export function extractVerificationUrl(emailBody) {
  if (!emailBody) return null;
  const patterns = [
    /https?:\/\/[^\s"'<>]*(?:verify|confirm|activate|validation)[^\s"'<>]*/gi,
    /href=["'](https?:\/\/[^"']*(?:verify|confirm|activate)[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*magnific[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*freepik[^"']*)["']/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...emailBody.matchAll(pattern)];
    for (const match of matches) {
      const url = match[1] || match[0];
      if (url.includes('magnific') || url.includes('freepik') || url.includes('verify') || url.includes('confirm')) {
        return url;
      }
    }
  }

  const allLinks = emailBody.match(/https?:\/\/[^\s"'<>]+/g) || [];
  for (const link of allLinks) {
    if (link.includes('verify') || link.includes('confirm') || link.includes('magnific') || link.includes('freepik')) return link;
  }
  return null;
}
