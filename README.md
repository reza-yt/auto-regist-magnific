# Magnific.ai Auto Registration & API Key Extractor (CLI)

Tool CLI untuk otomasi registrasi akun magnific.ai, konfirmasi email, dan ekstraksi API key secara otomatis.

## Fitur

- **Auto Registrasi** - Daftar akun magnific.ai otomatis
- **Temp Mail** - Mail.tm (gratis), Guerrilla Mail (gratis), Kopeechka (berbayar)
- **Auto Konfirmasi Email** - Deteksi & klik link verifikasi otomatis
- **Auto Get API Key** - Login & ekstrak API key dari dashboard
- **Anti-Detect Browser** - Fingerprint spoofing (WebGL, Canvas, Audio, Timezone, dll)
- **Free Proxy Scraper** - Otomatis ambil 300+ proxy gratis dari internet
- **Proxy Rotation** - HTTP/HTTPS/SOCKS4/SOCKS5 dengan auto-rotation
- **Human-Like Behavior** - Typing, clicking, scrolling mirip manusia
- **Batch Mode** - Registrasi banyak akun sekaligus

## Persyaratan

- **Node.js** >= 18.x
- **npm** atau **yarn**

## Instalasi

```bash
git clone https://github.com/reza-yt/auto-regist-magnific.git
cd auto-regist-magnific

# Install dependencies
npm install

# Install Playwright Chromium browser
npx playwright install chromium

# Copy config
cp .env.example .env
```

## Penggunaan

### Mode Single (1 Akun)

```bash
node src/index.js
```

### Mode Batch (Banyak Akun)

```bash
node src/index.js --mode=batch --count=5
```

### Scrape Proxy Dulu (Manual)

```bash
node src/proxy/scraper.js
```

### CLI Options

```
Options:
  -m, --mode <mode>       register (single) atau batch (default: register)
  -c, --count <number>    Jumlah akun batch mode (default: 5)
  --concurrency <number>  Registrasi bersamaan (default: 1)
  --provider <name>       mail_tm, guerrilla, kopeechka
  --proxy <url>           Single proxy URL
  --no-headless           Browser visible (debug)
  --output <file>         File output API keys
  -h, --help              Bantuan
```

### Contoh

```bash
# Single + proxy manual
node src/index.js --proxy="socks5://user:pass@1.2.3.4:1080"

# Batch 10 akun, auto scrape proxy
node src/index.js --mode=batch --count=10

# Debug mode (lihat browser)
node src/index.js --no-headless

# Pakai kopeechka (paling reliable)
node src/index.js --provider=kopeechka
```

## Konfigurasi (.env)

```env
# Proxy mode: scrape (auto), file (dari proxies.txt), single
PROXY_MODE=scrape

# Temp mail provider
TEMP_MAIL_PROVIDER=mail_tm

# Browser headless
HEADLESS=true

# Output
OUTPUT_FILE=api_keys.txt
```

## Struktur Project

```
auto-regist-magnific/
├── src/
│   ├── index.js                 # Main CLI
│   ├── config.js                # Config loader
│   ├── browser/
│   │   ├── browser-manager.js   # Anti-detect browser
│   │   └── fingerprint.js       # Fingerprint spoofing
│   ├── mail/
│   │   ├── index.js             # Mail factory + fallback
│   │   ├── mail-tm.js           # Mail.tm (gratis)
│   │   ├── guerrilla-mail.js    # Guerrilla Mail (gratis)
│   │   └── kopeechka.js         # Kopeechka (berbayar)
│   ├── proxy/
│   │   ├── index.js             # Proxy manager + rotation
│   │   └── scraper.js           # Free proxy scraper
│   ├── registration/
│   │   ├── register.js          # Registration flow
│   │   └── api-key-extractor.js # API key extraction
│   └── utils/
│       ├── helpers.js           # Utilities
│       └── logger.js            # Logger
├── proxies.txt                  # Proxy list (auto-generated or manual)
├── api_keys.txt                 # Output API keys
├── .env.example                 # Config template
└── package.json
```

## Output

API keys disimpan di `api_keys.txt`:

```
[2025-01-15T10:30:45.123Z]
Email: randomuser@domain.com
Password: xK9#mP2$nQ7wL4
API Key: mk_live_abc123def456...
============================================================
```

## Anti-Detect

- Random User-Agent (Chrome terbaru, multi-platform)
- WebGL Vendor & Renderer spoofing
- Canvas fingerprint noise
- AudioContext spoofing
- Timezone + geolocation matching
- Navigator override (platform, cores, memory)
- WebDriver flag removal
- Chrome runtime mock
- Human-like typing (variable speed, typos)
- Random scrolling & mouse movement

## Tips

1. **Pakai proxy** - Tanpa proxy IP cepat diblock
2. **Kopeechka** untuk reliability terbaik (domain real)
3. **Jangan spam** - Delay minimal 10-15 detik antar registrasi
4. **Debug** - Pakai `--no-headless` kalau gagal
5. **Auto scrape** - Set `PROXY_MODE=scrape` untuk otomatis ambil proxy gratis

## License

MIT
