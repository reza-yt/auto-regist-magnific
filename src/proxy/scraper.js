#!/usr/bin/env node
/**
 * Free Proxy Scraper
 * Scrapes free proxies from 11+ public sources
 * Supports: HTTP, SOCKS4, SOCKS5
 * Can be run standalone: node src/proxy/scraper.js
 */
import axios from 'axios';
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

/**
 * Scrape proxies from all sources
 * @param {object} options
 * @param {number} options.timeout - Request timeout in ms (default: 15000)
 * @param {number} options.maxProxies - Max proxies to return (default: 300)
 * @returns {string[]} Array of proxy URLs (protocol://host:port)
 */
export async function scrapeProxies(options = {}) {
  const { timeout = 15000, maxProxies = 300 } = options;
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

  // Limit
  const final = shuffled.slice(0, maxProxies);

  const breakdown = {
    http: final.filter(p => p.startsWith('http://')).length,
    socks5: final.filter(p => p.startsWith('socks5://')).length,
    socks4: final.filter(p => p.startsWith('socks4://')).length,
  };

  logger.info(`Scraped ${final.length} proxies from ${sourcesUsed}/${PROXY_SOURCES.length} sources`);
  logger.info(`  HTTP: ${breakdown.http} | SOCKS5: ${breakdown.socks5} | SOCKS4: ${breakdown.socks4}`);

  return final;
}

/**
 * Scrape and save to proxies.txt
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
    '# Auto-scraped free proxies',
    `# Generated: ${new Date().toISOString()}`,
    `# Total: ${proxies.length}`,
    '#',
    ...proxies,
  ].join('\n');

  writeFileSync(file, content, 'utf-8');
  logger.info(`Saved ${proxies.length} proxies to: ${file}`);
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
