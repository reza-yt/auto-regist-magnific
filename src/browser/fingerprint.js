/**
 * Anti-Detect Browser Fingerprint Module
 * Generates random, consistent fingerprints for each browser session
 * Covers: User-Agent, WebGL, Canvas, AudioContext, Screen, Timezone, Fonts, etc.
 */
import { randomInt } from '../utils/helpers.js';

// Realistic GPU renderers by vendor
const GPU_RENDERERS = {
  'Google Inc.': [
    'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
    'ANGLE (AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)',
  ],
  'Intel Inc.': [
    'Intel(R) Iris(TM) Plus Graphics 640',
    'Intel(R) UHD Graphics 630',
    'Intel(R) Iris(R) Xe Graphics',
  ],
  'NVIDIA Corporation': [
    'NVIDIA GeForce GTX 1080/PCIe/SSE2',
    'NVIDIA GeForce RTX 3070/PCIe/SSE2',
    'NVIDIA GeForce RTX 4080/PCIe/SSE2',
  ],
};

// Common screen resolutions
const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
  { width: 1920, height: 1200 },
  { width: 3840, height: 2160 },
];

// Common timezones
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'America/Toronto',
  'Europe/Amsterdam',
];

// Common locales
const LOCALES = [
  'en-US', 'en-GB', 'en-CA', 'en-AU',
  'fr-FR', 'de-DE', 'es-ES', 'it-IT',
  'pt-BR', 'ja-JP', 'ko-KR', 'nl-NL',
];

// Platform strings
const PLATFORMS = [
  'Win32', 'Win64', 'MacIntel', 'Linux x86_64',
];

// Common fonts
const FONT_SETS = [
  ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Trebuchet MS'],
  ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Tahoma', 'Palatino'],
  ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia', 'Impact', 'Comic Sans MS'],
  ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Segoe UI', 'Roboto', 'Open Sans'],
];

// Hardware concurrency values (CPU cores)
const HARDWARE_CONCURRENCIES = [2, 4, 6, 8, 12, 16];

// Device memory values (GB)
const DEVICE_MEMORIES = [2, 4, 8, 16, 32];

/**
 * Generate a complete random fingerprint profile
 */
export function generateFingerprint() {
  const vendor = pickRandom(Object.keys(GPU_RENDERERS));
  const renderer = pickRandom(GPU_RENDERERS[vendor]);
  const screen = pickRandom(SCREEN_RESOLUTIONS);
  const timezone = pickRandom(TIMEZONES);
  const locale = pickRandom(LOCALES);
  const platform = pickRandom(PLATFORMS);
  const fonts = pickRandom(FONT_SETS);
  const hardwareConcurrency = pickRandom(HARDWARE_CONCURRENCIES);
  const deviceMemory = pickRandom(DEVICE_MEMORIES);

  // Generate viewport slightly smaller than screen
  const viewportWidth = screen.width - randomInt(0, 100);
  const viewportHeight = screen.height - randomInt(60, 150); // Account for taskbar/dock

  // Canvas noise seed (unique per session)
  const canvasNoiseSeed = Math.random();

  // Audio context noise
  const audioNoiseSeed = Math.random() * 0.0001;

  return {
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.width,
      availHeight: screen.height - randomInt(30, 60),
      colorDepth: pickRandom([24, 32]),
      pixelDepth: pickRandom([24, 32]),
    },
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
    webgl: {
      vendor: vendor,
      renderer: renderer,
      unmaskedVendor: vendor,
      unmaskedRenderer: renderer,
    },
    canvas: {
      noiseSeed: canvasNoiseSeed,
      noiseIntensity: Math.random() * 0.02 + 0.01, // 1-3% noise
    },
    audio: {
      noiseSeed: audioNoiseSeed,
      sampleRate: pickRandom([44100, 48000]),
      channelCount: pickRandom([2, 6]),
    },
    timezone: timezone,
    locale: locale,
    platform: platform,
    fonts: fonts,
    hardwareConcurrency: hardwareConcurrency,
    deviceMemory: deviceMemory,
    maxTouchPoints: platform.includes('Win') || platform.includes('Linux') ? 0 : randomInt(0, 5),
    doNotTrack: pickRandom([null, '1']),
    // Connection info
    connection: {
      effectiveType: pickRandom(['4g', '3g']),
      downlink: pickRandom([1.5, 2.5, 5, 10, 20, 50]),
      rtt: pickRandom([50, 100, 150, 200]),
    },
    // Battery API spoofing
    battery: {
      charging: pickRandom([true, false]),
      level: Math.random() * 0.7 + 0.3, // 30-100%
      chargingTime: randomInt(0, 7200),
      dischargingTime: randomInt(3600, 28800),
    },
  };
}

/**
 * Generate injection scripts for browser context
 * These scripts modify browser APIs to return spoofed fingerprint values
 */
export function generateInjectionScripts(fingerprint) {
  return `
    // ==========================================
    // ANTI-DETECT FINGERPRINT INJECTION
    // ==========================================

    // --- Navigator overrides ---
    Object.defineProperty(navigator, 'platform', { get: () => '${fingerprint.platform}' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${fingerprint.hardwareConcurrency} });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => ${fingerprint.deviceMemory} });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => ${fingerprint.maxTouchPoints} });
    Object.defineProperty(navigator, 'language', { get: () => '${fingerprint.locale}' });
    Object.defineProperty(navigator, 'languages', { get: () => ['${fingerprint.locale}', '${fingerprint.locale.split('-')[0]}'] });
    ${fingerprint.doNotTrack ? `Object.defineProperty(navigator, 'doNotTrack', { get: () => '${fingerprint.doNotTrack}' });` : ''}

    // --- Screen overrides ---
    Object.defineProperty(screen, 'width', { get: () => ${fingerprint.screen.width} });
    Object.defineProperty(screen, 'height', { get: () => ${fingerprint.screen.height} });
    Object.defineProperty(screen, 'availWidth', { get: () => ${fingerprint.screen.availWidth} });
    Object.defineProperty(screen, 'availHeight', { get: () => ${fingerprint.screen.availHeight} });
    Object.defineProperty(screen, 'colorDepth', { get: () => ${fingerprint.screen.colorDepth} });
    Object.defineProperty(screen, 'pixelDepth', { get: () => ${fingerprint.screen.pixelDepth} });

    // --- WebGL spoofing ---
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      const UNMASKED_VENDOR_WEBGL = 0x9245;
      const UNMASKED_RENDERER_WEBGL = 0x9246;
      if (param === UNMASKED_VENDOR_WEBGL) return '${fingerprint.webgl.unmaskedVendor}';
      if (param === UNMASKED_RENDERER_WEBGL) return '${fingerprint.webgl.unmaskedRenderer}';
      return originalGetParameter.call(this, param);
    };

    // Also handle WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        const UNMASKED_VENDOR_WEBGL = 0x9245;
        const UNMASKED_RENDERER_WEBGL = 0x9246;
        if (param === UNMASKED_VENDOR_WEBGL) return '${fingerprint.webgl.unmaskedVendor}';
        if (param === UNMASKED_RENDERER_WEBGL) return '${fingerprint.webgl.unmaskedRenderer}';
        return originalGetParameter2.call(this, param);
      };
    }

    // --- Canvas noise injection ---
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
      const context = this.getContext('2d');
      if (context && this.width > 0 && this.height > 0) {
        try {
          const imageData = context.getImageData(0, 0, this.width, this.height);
          const data = imageData.data;
          const seed = ${fingerprint.canvas.noiseSeed};
          for (let i = 0; i < data.length; i += 4) {
            // Add subtle noise to RGB channels (not alpha)
            const noise = (Math.sin(i * seed * 12.9898) * 43758.5453) % 1;
            data[i] = Math.max(0, Math.min(255, data[i] + (noise * ${fingerprint.canvas.noiseIntensity} * 255) | 0));
          }
          context.putImageData(imageData, 0, 0);
        } catch(e) {}
      }
      return originalToDataURL.call(this, type, quality);
    };

    // --- Canvas toBlob noise ---
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      const context = this.getContext('2d');
      if (context && this.width > 0 && this.height > 0) {
        try {
          const imageData = context.getImageData(0, 0, this.width, this.height);
          const data = imageData.data;
          const seed = ${fingerprint.canvas.noiseSeed};
          for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.sin(i * seed * 12.9898) * 43758.5453) % 1;
            data[i] = Math.max(0, Math.min(255, data[i] + (noise * ${fingerprint.canvas.noiseIntensity} * 255) | 0));
          }
          context.putImageData(imageData, 0, 0);
        } catch(e) {}
      }
      return originalToBlob.call(this, callback, type, quality);
    };

    // --- AudioContext fingerprint spoofing ---
    const originalCreateOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function() {
      const oscillator = originalCreateOscillator.call(this);
      const originalConnect = oscillator.connect;
      oscillator.connect = function(destination) {
        // Add subtle variation to audio processing
        if (destination instanceof AnalyserNode) {
          const originalGetFloatFrequencyData = destination.getFloatFrequencyData;
          destination.getFloatFrequencyData = function(array) {
            originalGetFloatFrequencyData.call(this, array);
            for (let i = 0; i < array.length; i++) {
              array[i] += ${fingerprint.audio.noiseSeed};
            }
          };
        }
        return originalConnect.apply(this, arguments);
      };
      return oscillator;
    };

    // --- Timezone spoofing ---
    const originalDateTimeFormat = Intl.DateTimeFormat;
    const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function() {
      const result = originalResolvedOptions.call(this);
      result.timeZone = '${fingerprint.timezone}';
      return result;
    };

    // --- Connection API ---
    if (navigator.connection) {
      Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '${fingerprint.connection.effectiveType}' });
      Object.defineProperty(navigator.connection, 'downlink', { get: () => ${fingerprint.connection.downlink} });
      Object.defineProperty(navigator.connection, 'rtt', { get: () => ${fingerprint.connection.rtt} });
    }

    // --- Battery API spoofing ---
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: ${fingerprint.battery.charging},
        level: ${fingerprint.battery.level.toFixed(2)},
        chargingTime: ${fingerprint.battery.chargingTime},
        dischargingTime: ${fingerprint.battery.dischargingTime},
        addEventListener: () => {},
        removeEventListener: () => {},
      });
    }

    // --- Permissions API masking ---
    const originalQuery = navigator.permissions.query;
    navigator.permissions.query = function(desc) {
      if (desc.name === 'notifications') {
        return Promise.resolve({ state: 'prompt', onchange: null });
      }
      return originalQuery.call(this, desc);
    };

    // --- WebDriver detection bypass ---
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    delete navigator.__proto__.webdriver;

    // --- Chrome runtime mock (avoid headless detection) ---
    window.chrome = {
      runtime: {
        onMessage: { addListener: () => {}, removeListener: () => {} },
        sendMessage: () => {},
        connect: () => ({ onMessage: { addListener: () => {} }, postMessage: () => {} }),
      },
      loadTimes: () => ({}),
      csi: () => ({}),
    };

    // --- Plugins mock ---
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        plugins.namedItem = (name) => plugins.find(p => p.name === name) || null;
        plugins.refresh = () => {};
        return plugins;
      }
    });

    // --- Prevent iframe detection ---
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });

    console.log('[Anti-Detect] Fingerprint injection complete');
  `;
}

/**
 * Get user agent strings by platform
 */
export function generateUserAgent(platform = null) {
  const chromeVersion = randomInt(120, 130);
  const majorVersion = chromeVersion;
  const minorVersion = `0.${randomInt(5000, 6999)}.${randomInt(50, 199)}`;

  const userAgents = {
    'Win32': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${majorVersion}.${minorVersion} Safari/537.36`,
    'Win64': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${majorVersion}.${minorVersion} Safari/537.36`,
    'MacIntel': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${majorVersion}.${minorVersion} Safari/537.36`,
    'Linux x86_64': `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${majorVersion}.${minorVersion} Safari/537.36`,
  };

  const selectedPlatform = platform || pickRandom(Object.keys(userAgents));
  return userAgents[selectedPlatform] || userAgents['Win64'];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default { generateFingerprint, generateInjectionScripts, generateUserAgent };
