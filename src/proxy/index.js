/**
 * Proxy Manager - Handles proxy rotation, validation, and agent creation
 * Supports: HTTP, HTTPS, SOCKS4, SOCKS5
 * Features: Auto-rotation, health checking, blacklisting dead proxies
 */
import { readFileSync, existsSync } from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { logger } from '../utils/logger.js';
import config from '../config.js';

export class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.blacklisted = new Set();
    this.usageCount = new Map(); // Track how many times each proxy was used
    this.lastUsed = new Map(); // Track last usage time
    this.minCooldown = 30000; // Minimum 30s between uses of same proxy
  }

  /**
   * Load proxies from file
   */
  loadFromFile(filePath = null) {
    const file = filePath || config.proxyListFile;

    if (!existsSync(file)) {
      logger.warn(`Proxy file not found: ${file}`);
      return this;
    }

    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    this.proxies = lines.map(line => this.parseProxy(line)).filter(Boolean);
    logger.info(`Loaded ${this.proxies.length} proxies from file`);
    return this;
  }

  /**
   * Add a single proxy
   */
  addProxy(proxyUrl) {
    const parsed = this.parseProxy(proxyUrl);
    if (parsed) {
      this.proxies.push(parsed);
    }
    return this;
  }

  /**
   * Parse proxy URL into structured object
   * Validates that host and port are actually valid
   */
  parseProxy(proxyStr) {
    try {
      if (!proxyStr || typeof proxyStr !== 'string') return null;
      const cleaned = proxyStr.trim();
      if (!cleaned || cleaned.length < 7) return null; // Minimum: "1.2.3:4"

      let url;
      if (cleaned.includes('://')) {
        url = new URL(cleaned);
      } else {
        const parts = cleaned.split(':');
        if (parts.length === 4) {
          url = new URL(`http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`);
        } else if (parts.length === 2) {
          url = new URL(`http://${parts[0]}:${parts[1]}`);
        } else {
          return null;
        }
      }

      const host = url.hostname;
      const port = parseInt(url.port);

      // Validate host (must be IP or valid domain)
      if (!host || host.length < 3) return null;

      // Validate port (must be valid number 1-65535)
      if (!port || isNaN(port) || port < 1 || port > 65535) return null;

      // Validate IP format if it looks like an IP
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        const octets = host.split('.').map(Number);
        if (octets.some(o => o < 0 || o > 255)) return null;
      }

      return {
        protocol: url.protocol.replace(':', ''),
        host,
        port,
        username: url.username || null,
        password: url.password || null,
        raw: cleaned,
        url: url.toString(),
      };
    } catch (error) {
      // Silently skip invalid proxies (don't spam logs during bulk import)
      return null;
    }
  }

  /**
   * Get next proxy using round-robin rotation with cooldown
   */
  getNext() {
    if (this.proxies.length === 0) {
      return null;
    }

    const available = this.proxies.filter(p =>
      !this.blacklisted.has(p.raw) &&
      (!this.lastUsed.has(p.raw) || Date.now() - this.lastUsed.get(p.raw) > this.minCooldown)
    );

    if (available.length === 0) {
      // If all proxies are on cooldown, use the one with oldest usage
      const sorted = this.proxies
        .filter(p => !this.blacklisted.has(p.raw))
        .sort((a, b) => (this.lastUsed.get(a.raw) || 0) - (this.lastUsed.get(b.raw) || 0));

      if (sorted.length === 0) {
        logger.error('All proxies blacklisted! No available proxies.');
        return null;
      }
      return this._selectAndTrack(sorted[0]);
    }

    // Round-robin through available proxies
    this.currentIndex = this.currentIndex % available.length;
    const proxy = available[this.currentIndex];
    this.currentIndex++;

    return this._selectAndTrack(proxy);
  }

  /**
   * Get a random proxy (better for anti-detection)
   */
  getRandom() {
    const available = this.proxies.filter(p => !this.blacklisted.has(p.raw));
    if (available.length === 0) return null;

    const proxy = available[Math.floor(Math.random() * available.length)];
    return this._selectAndTrack(proxy);
  }

  _selectAndTrack(proxy) {
    this.lastUsed.set(proxy.raw, Date.now());
    this.usageCount.set(proxy.raw, (this.usageCount.get(proxy.raw) || 0) + 1);
    return proxy;
  }

  /**
   * Create an HTTP agent for axios/node-fetch from a proxy
   */
  createAgent(proxy = null) {
    const p = proxy || this.getNext();
    if (!p) return null;

    try {
      const isSocks = p.protocol.startsWith('socks');
      const auth = p.username ? `${p.username}:${p.password}@` : '';

      if (isSocks) {
        const socksUrl = `${p.protocol}://${auth}${p.host}:${p.port}`;
        return new SocksProxyAgent(socksUrl);
      } else {
        const httpUrl = `http://${auth}${p.host}:${p.port}`;
        return new HttpsProxyAgent(httpUrl);
      }
    } catch (error) {
      logger.warn(`Failed to create agent for ${p.host}:${p.port}: ${error.message}`);
      this.blacklist(p);
      // Try next proxy
      const next = this.getNext();
      if (next && next.raw !== p.raw) {
        return this.createAgent(next);
      }
      return null;
    }
  }

  /**
   * Get proxy configuration for Playwright browser
   */
  getPlaywrightProxy(proxy = null) {
    const p = proxy || this.getNext();
    if (!p) return null;

    const server = `${p.protocol}://${p.host}:${p.port}`;
    const proxyConfig = { server };

    if (p.username) {
      proxyConfig.username = p.username;
      proxyConfig.password = p.password;
    }

    return proxyConfig;
  }

  /**
   * Blacklist a proxy (mark as dead/blocked)
   */
  blacklist(proxy) {
    const raw = typeof proxy === 'string' ? proxy : proxy.raw;
    this.blacklisted.add(raw);
    logger.warn(`Proxy blacklisted: ${raw} (${this.blacklisted.size}/${this.proxies.length} blacklisted)`);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.proxies.length,
      available: this.proxies.length - this.blacklisted.size,
      blacklisted: this.blacklisted.size,
      usageCounts: Object.fromEntries(this.usageCount),
    };
  }

  /**
   * Check if we have any usable proxies
   */
  hasProxies() {
    return this.proxies.length > 0 && this.proxies.length > this.blacklisted.size;
  }
}

/**
 * Create and initialize proxy manager based on config
 */
export async function createProxyManager() {
  const manager = new ProxyManager();

  switch (config.proxyMode) {
    case 'file':
      manager.loadFromFile();
      break;
    case 'single':
      if (config.proxyUrl) {
        manager.addProxy(config.proxyUrl);
      }
      break;
    case 'rotating_service':
      if (config.rotatingProxyUrl) {
        manager.addProxy(config.rotatingProxyUrl);
      }
      break;
    case 'scrape':
      // Auto-scrape free proxies from internet
      try {
        const { scrapeProxies } = await import('./scraper.js');
        const proxies = await scrapeProxies();
        for (const p of proxies) {
          manager.addProxy(p);
        }
        logger.info(`Auto-scraped ${proxies.length} free proxies`);
      } catch (error) {
        logger.warn(`Proxy scraping failed: ${error.message}. Trying file fallback...`);
        manager.loadFromFile();
      }
      break;
    default:
      manager.loadFromFile();
  }

  if (!manager.hasProxies()) {
    logger.warn('⚠ No proxies loaded! Running without proxy (not recommended).');
  }

  return manager;
}

export default ProxyManager;
