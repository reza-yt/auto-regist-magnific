#!/usr/bin/env node
/**
 * Free Proxy Scraper + Validator
 * Scrapes free proxies from 11+ public sources
 * Then validates them (checks live/die) before using
 * Supports: HTTP, SOCKS4, SOCKS5
 * Can be run standalone: node src/proxy/scraper.js
 */
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { logger } from '../utils/logger.js';

const PROXY_SOURCES = [
  {
    name: 'ProxyScrape HTTP',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    type: 'http',
  },
  {
    name: 'ProxyScrape SOCKS5',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all',
    type: 'socks5',
  },
  {
    name: 'ProxyScrape SOCKS4',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all',
    type: 'socks4',
  },
  {
    name: 'TheSpeedX HTTP',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    type: 'http',
  },
  {
    name: 'TheSpeedX SOCKS5',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    type: 'socks5',
  },
  {
    name: 'Monosans HTTP',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    type: 'http',
  },
  {
    name: 'Monosans SOCKS5',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    type: 'socks5',
  },
  {
    name: 'Hookzof SOCKS5',
    url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    type: 'socks5',
  },
  {
    name: 'MuRongPIG HTTP',
    url: 'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt',
    type: 'http',
  },
  {
    name: 'ProxyList Download HTTP',
    url: 'https://www.proxy-list.download/api/v1/get?type=http',
    type: 'http',
  },
  {
    name: 'ProxyList Download SOCKS5',
    url: 'https://www.proxy-list.download/api/v1/get?type=socks5',
    type: 'socks5',
  },
];

// URLs to test proxy connectivity (fast, reliable endpoints)
const TEST_URLS = [
  'https://httpbin.org/ip',
  'http://ip-api.com/json',
  'https://api.ipify.org?format=json',
];

/**
 * Check if a single proxy is alive (LIVE or DIE)
 * @param {string} proxyUrl - Full proxy URL (e.g., http://1.2.3.4:8080)
 * @param {number} timeout - Timeout in ms (default: 8000)
 * @returns {object} { alive: boolean, latency: number, ip: string|null }
 */
export async function checkProxy(proxyUrl, timeout = 8000) {
  const startTime = Date.now();

  try {
    let agent;
    if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://')) {
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      agent = new HttpsProxyAgent(proxyUrl);
    }

    const testUrl = TEST_URLS[Math.floor(Math.random() * TEST_URLS.length)];

    const res = await axios.get(testUrl, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      },
      validateStatus: (status) => status < 500,
    });

    const latency = Date.now() - startTime;

    // Extract IP from response if possible
    let ip = null;
    if (res.data) {
      if (typeof res.data === 'object') {
        ip = res.data.origin || res.data.ip || res.data.query || null;
      } else if (typeof res.data === 'string') {
        const match = res.data.match(/\d+\.\d+\.\d+\.\d+/);
        if (match) ip = match[0];
      }
    }

    return { alive: true, latency, ip };
  } catch (error) {
    return { alive: false, latency: Date.now() - startTime, ip: null };
  }
}

/**
 * Validate multiple proxies concurrently
 * Checks live/die and returns only LIVE proxies sorted by latency
 * @param {string[]} proxies - Array of proxy URLs
 * @param {object} options
 * @param {number} options.concurrency - Concurrent checks (default: 50)
 * @param {number} options.timeout - Per-proxy timeout (default: 8000)
 * @param {number} options.maxLive - Stop after finding this many live proxies (default: 100)
 * @returns {object[]} Array of { proxy, latency, ip }
 */
export async function validateProxies(proxies, options = {}) {
  const { concurrency = 50, timeout = 8000, maxLive = 100 } = options;

  logger.info(`Validating ${proxies.length} proxies (concurrency: ${concurrency}, timeout: ${timeout}ms)...`);
  logger.info(`Will stop after finding ${maxLive} live proxies`);

  const liveProxies = [];
  let checked = 0;
  let died = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < proxies.length; i += concurrency) {
    // Stop early if we have enough live proxies
    if (liveProxies.length >= maxLive) break;

    const batch = proxies.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (proxy) => {
        const result = await checkProxy(proxy, timeout);
        return { proxy, ...result };
      })
    );

    for (const result of results) {
      checked++;
      if (result.status === 'fulfilled' && result.value.alive) {
        liveProxies.push(result.value);
      } else {
        died++;
      }
    }

    // Progress log every 100 checked
    if (checked % 100 === 0 || liveProxies.length >= maxLive) {
      logger.info(`  Checked: ${checked}/${proxies.length} | Live: ${liveProxies.length} | Die: ${died}`);
    }
  }

  // Sort by latency (fastest first)
  liveProxies.sort((a, b) => a.latency - b.latency);

  logger.info(`Validation complete! Live: ${liveProxies.length} | Die: ${died} | Total checked: ${checked}`);

  if (liveProxies.length > 0) {
    const avgLatency = Math.round(liveProxies.reduce((sum, p) => sum + p.latency, 0) / liveProxies.length);
    logger.info(`  Average latency: ${avgLatency}ms | Fastest: ${liveProxies[0].latency}ms`);
  }

  return liveProxies;
}

/**
 * Scrape proxies from all sources
 * @param {object} options
 * @param {number} options.timeout - Request timeout in ms (default: 15000)
 * @param {number} options.maxProxies - Max proxies to scrape before validation (default: 500)
 * @returns {string[]} Array of proxy URLs (protocol://host:port)
 */
export async function scrapeProxies(options = {}) {
  const { timeout = 15000, maxProxies = 500 } = options;
  const allProxies = [];
  let sourcesUsed = 0;

  logger.info('Scraping free proxies from internet...');

  const results = await Promise.allSettled(
    PROXY_SOURCES.map(async (source) => {
      try {
        const res = await axios.get(source.url, {
          timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          },
          responseType: 'text',
        });

        if (res.status === 200 && res.data) {
          const text = typeof res.data === 'string' ? res.data : String(res.data);
          const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l && l.includes(':') && !l.startsWith('#'));

          const proxies = lines.map(l => `${source.type}://${l}`);
          return { name: source.name, proxies, count: proxies.length };
        }
        return { name: source.name, proxies: [], count: 0 };
      } catch (err) {
        return { name: source.name, proxies: [], count: 0, error: err.message };
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.count > 0) {
      allProxies.push(...result.value.proxies);
      sourcesUsed++;
    }
  }

  // Deduplicate
  const unique = [...new Set(allProxies)];

  // Shuffle for randomness
  const shuffled = unique.sort(() => Math.random() - 0.5);

  // Limit before validation (don't try to validate thousands)
  const toValidate = shuffled.slice(0, maxProxies);

  const breakdown = {
    http: toValidate.filter(p => p.startsWith('http://')).length,
    socks5: toValidate.filter(p => p.startsWith('socks5://')).length,
    socks4: toValidate.filter(p => p.startsWith('socks4://')).length,
  };

  logger.info(`Scraped ${unique.length} proxies from ${sourcesUsed}/${PROXY_SOURCES.length} sources`);
  logger.info(`  HTTP: ${breakdown.http} | SOCKS5: ${breakdown.socks5} | SOCKS4: ${breakdown.socks4}`);

  // VALIDATE: Check live/die
  logger.info('');
  logger.info('Checking proxies (live/die)...');
  const liveResults = await validateProxies(toValidate, {
    concurrency: 50,
    timeout: 8000,
    maxLive: 100, // Stop after finding 100 live proxies
  });

  // Return only LIVE proxy URLs
  const liveProxies = liveResults.map(r => r.proxy);

  if (liveProxies.length === 0) {
    logger.warn('No live proxies found! All proxies are dead.');
  } else {
    logger.info(`Using ${liveProxies.length} LIVE proxies (fastest: ${liveResults[0].latency}ms)`);
  }

  return liveProxies;
}

/**
 * Scrape, validate, and save to proxies.txt
 */
export async function scrapeAndSave(outputFile = null) {
  const { join, dirname } = await import('path');
  const { writeFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const file = outputFile || join(__dirname, '..', '..', 'proxies.txt');

  const proxies = await scrapeProxies();

  const content = [
    '# Auto-scraped & validated LIVE proxies',
    `# Generated: ${new Date().toISOString()}`,
    `# Total LIVE: ${proxies.length}`,
    '# All proxies below have been tested and confirmed working',
    '#',
    ...proxies,
  ].join('\n');

  writeFileSync(file, content, 'utf-8');
  logger.info(`Saved ${proxies.length} LIVE proxies to: ${file}`);
  return proxies;
}

// Run standalone
if (process.argv[1] && process.argv[1].includes('scraper')) {
  scrapeAndSave().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Scraper failed:', err.message);
    process.exit(1);
  });
}
