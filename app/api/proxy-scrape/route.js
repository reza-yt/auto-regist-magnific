/**
 * API Route: /api/proxy-scrape
 * Scrapes free proxies from multiple public sources
 * Returns validated proxy list
 */
import { NextResponse } from 'next/server';
import axios from 'axios';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Free proxy sources
const PROXY_SOURCES = [
  {
    name: 'ProxyScrape HTTP',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    type: 'http',
    parse: (text) => text.split('\n').filter(l => l.trim()).map(l => `http://${l.trim()}`),
  },
  {
    name: 'ProxyScrape SOCKS5',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all',
    type: 'socks5',
    parse: (text) => text.split('\n').filter(l => l.trim()).map(l => `socks5://${l.trim()}`),
  },
  {
    name: 'ProxyScrape SOCKS4',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all',
    type: 'socks4',
    parse: (text) => text.split('\n').filter(l => l.trim()).map(l => `socks4://${l.trim()}`),
  },
  {
    name: 'TheSpeedX HTTP',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    type: 'http',
    parse: (text) => text.split('\n').filter(l => l.trim() && l.includes(':')).map(l => `http://${l.trim()}`),
  },
  {
    name: 'TheSpeedX SOCKS5',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    type: 'socks5',
    parse: (text) => text.split('\n').filter(l => l.trim() && l.includes(':')).map(l => `socks5://${l.trim()}`),
  },
  {
    name: 'Monosans HTTP',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    type: 'http',
    parse: (text) => text.split('\n').filter(l => l.trim() && l.includes(':')).map(l => `http://${l.trim()}`),
  },
  {
    name: 'Monosans SOCKS5',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    type: 'socks5',
    parse: (text) => text.split('\n').filter(l => l.trim() && l.includes(':')).map(l => `socks5://${l.trim()}`),
  },
  {
    name: 'Hookzof HTTP',
    url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    type: 'socks5',
    parse: (text) => text.split('\n').filter(l => l.trim() && l.includes(':')).map(l => `socks5://${l.trim()}`),
  },
  {
    name: 'MuRongPIG HTTP',
    url: 'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt',
    type: 'http',
    parse: (text) => text.split('\n').filter(l => l.trim() && l.includes(':')).map(l => `http://${l.trim()}`),
  },
  {
    name: 'ProxyList Download HTTP',
    url: 'https://www.proxy-list.download/api/v1/get?type=http',
    type: 'http',
    parse: (text) => text.split('\n').filter(l => l.trim() && l.includes(':')).map(l => `http://${l.trim()}`),
  },
  {
    name: 'ProxyList Download SOCKS5',
    url: 'https://www.proxy-list.download/api/v1/get?type=socks5',
    type: 'socks5',
    parse: (text) => text.split('\n').filter(l => l.trim() && l.includes(':')).map(l => `socks5://${l.trim()}`),
  },
];

export async function GET() {
  const allProxies = [];
  let sourcesUsed = 0;
  const errors = [];

  // Fetch from all sources in parallel
  const results = await Promise.allSettled(
    PROXY_SOURCES.map(async (source) => {
      try {
        const res = await axios.get(source.url, {
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
        });

        if (res.status === 200 && res.data) {
          const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
          const proxies = source.parse(text);
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
    } else if (result.status === 'fulfilled' && result.value.error) {
      errors.push(`${result.value.name}: ${result.value.error}`);
    }
  }

  // Deduplicate proxies
  const uniqueProxies = [...new Set(allProxies)];

  // Shuffle for randomness
  const shuffled = uniqueProxies.sort(() => Math.random() - 0.5);

  // Limit to reasonable amount (max 500)
  const finalProxies = shuffled.slice(0, 500);

  return NextResponse.json({
    success: true,
    proxies: finalProxies,
    total: uniqueProxies.length,
    returned: finalProxies.length,
    sources: sourcesUsed,
    totalSources: PROXY_SOURCES.length,
    breakdown: {
      http: finalProxies.filter(p => p.startsWith('http://')).length,
      socks5: finalProxies.filter(p => p.startsWith('socks5://')).length,
      socks4: finalProxies.filter(p => p.startsWith('socks4://')).length,
    },
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
}
