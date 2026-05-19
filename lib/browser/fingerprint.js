/**
 * Anti-Detect Browser Fingerprint Module (Serverless version)
 * Generates random, consistent fingerprints per session
 */

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

const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 }, { width: 2560, height: 1440 },
  { width: 1366, height: 768 }, { width: 1536, height: 864 },
  { width: 1440, height: 900 }, { width: 1680, height: 1050 },
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
];

const LOCALES = ['en-US', 'en-GB', 'en-CA', 'fr-FR', 'de-DE', 'es-ES'];
const PLATFORMS = ['Win32', 'Win64', 'MacIntel', 'Linux x86_64'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export function generateFingerprint() {
  const vendor = pick(Object.keys(GPU_RENDERERS));
  const renderer = pick(GPU_RENDERERS[vendor]);
  const screen = pick(SCREEN_RESOLUTIONS);
  const timezone = pick(TIMEZONES);
  const locale = pick(LOCALES);
  const platform = pick(PLATFORMS);

  return {
    screen: { width: screen.width, height: screen.height, availWidth: screen.width, availHeight: screen.height - randInt(30, 60), colorDepth: pick([24, 32]), pixelDepth: pick([24, 32]) },
    viewport: { width: screen.width - randInt(0, 100), height: screen.height - randInt(60, 150) },
    webgl: { vendor, renderer, unmaskedVendor: vendor, unmaskedRenderer: renderer },
    canvas: { noiseSeed: Math.random(), noiseIntensity: Math.random() * 0.02 + 0.01 },
    audio: { noiseSeed: Math.random() * 0.0001, sampleRate: pick([44100, 48000]) },
    timezone, locale, platform,
    hardwareConcurrency: pick([2, 4, 6, 8, 12, 16]),
    deviceMemory: pick([2, 4, 8, 16, 32]),
    maxTouchPoints: platform.includes('Win') || platform.includes('Linux') ? 0 : randInt(0, 5),
    doNotTrack: pick([null, '1']),
    connection: { effectiveType: pick(['4g', '3g']), downlink: pick([1.5, 5, 10, 20, 50]), rtt: pick([50, 100, 150, 200]) },
    battery: { charging: pick([true, false]), level: Math.random() * 0.7 + 0.3, chargingTime: randInt(0, 7200), dischargingTime: randInt(3600, 28800) },
  };
}

export function generateUserAgent(platform = null) {
  const v = randInt(120, 130);
  const minor = `0.${randInt(5000, 6999)}.${randInt(50, 199)}`;
  const uas = {
    'Win32': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.${minor} Safari/537.36`,
    'Win64': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.${minor} Safari/537.36`,
    'MacIntel': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.${minor} Safari/537.36`,
    'Linux x86_64': `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.${minor} Safari/537.36`,
  };
  return uas[platform || pick(Object.keys(uas))];
}

export function generateInjectionScripts(fp) {
  return `
    Object.defineProperty(navigator, 'platform', { get: () => '${fp.platform}' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${fp.hardwareConcurrency} });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => ${fp.deviceMemory} });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => ${fp.maxTouchPoints} });
    Object.defineProperty(navigator, 'language', { get: () => '${fp.locale}' });
    Object.defineProperty(navigator, 'languages', { get: () => ['${fp.locale}', '${fp.locale.split('-')[0]}'] });
    Object.defineProperty(screen, 'width', { get: () => ${fp.screen.width} });
    Object.defineProperty(screen, 'height', { get: () => ${fp.screen.height} });
    Object.defineProperty(screen, 'colorDepth', { get: () => ${fp.screen.colorDepth} });

    const origGetParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(p) {
      if (p === 0x9245) return '${fp.webgl.unmaskedVendor}';
      if (p === 0x9246) return '${fp.webgl.unmaskedRenderer}';
      return origGetParam.call(this, p);
    };
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(p) {
        if (p === 0x9245) return '${fp.webgl.unmaskedVendor}';
        if (p === 0x9246) return '${fp.webgl.unmaskedRenderer}';
        return origGetParam2.call(this, p);
      };
    }

    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
      const ctx = this.getContext('2d');
      if (ctx && this.width > 0 && this.height > 0) {
        try {
          const img = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < img.data.length; i += 4) {
            const n = (Math.sin(i * ${fp.canvas.noiseSeed} * 12.9898) * 43758.5453) % 1;
            img.data[i] = Math.max(0, Math.min(255, img.data[i] + (n * ${fp.canvas.noiseIntensity} * 255) | 0));
          }
          ctx.putImageData(img, 0, 0);
        } catch(e) {}
      }
      return origToDataURL.call(this, type, quality);
    };

    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    delete navigator.__proto__.webdriver;
    window.chrome = { runtime: { onMessage: { addListener: ()=>{} }, sendMessage: ()=>{} }, loadTimes: ()=>({}), csi: ()=>({}) };
    Object.defineProperty(navigator, 'plugins', { get: () => [{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' }, { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' }] });

    ${fp.doNotTrack ? `Object.defineProperty(navigator, 'doNotTrack', { get: () => '${fp.doNotTrack}' });` : ''}

    if (navigator.connection) {
      Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '${fp.connection.effectiveType}' });
      Object.defineProperty(navigator.connection, 'downlink', { get: () => ${fp.connection.downlink} });
      Object.defineProperty(navigator.connection, 'rtt', { get: () => ${fp.connection.rtt} });
    }

    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({ charging: ${fp.battery.charging}, level: ${fp.battery.level.toFixed(2)}, chargingTime: ${fp.battery.chargingTime}, dischargingTime: ${fp.battery.dischargingTime}, addEventListener:()=>{} });
    }
  `;
}
