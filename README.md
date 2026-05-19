# 🚀 Magnific.ai Auto Registration & API Key Extractor

Alat otomasi lengkap untuk registrasi akun magnific.ai, konfirmasi email, dan ekstraksi API key secara otomatis.

## ✨ Fitur Utama

- **Auto Registrasi** - Otomatis mendaftar akun magnific.ai
- **Temp Mail Multi-Provider** - Mendukung Mail.tm (gratis), Guerrilla Mail (gratis), dan Kopeechka (berbayar, paling reliable)
- **Auto Konfirmasi Email** - Otomatis mendeteksi dan mengklik link verifikasi
- **Auto Get API Key** - Login otomatis dan ekstrak API key dari dashboard
- **Anti-Detect Browser** - Fingerprint spoofing lengkap (WebGL, Canvas, Audio, Timezone, dll)
- **Proxy Rotation** - Support HTTP/HTTPS/SOCKS4/SOCKS5 dengan auto-rotation
- **Human-Like Behavior** - Typing, clicking, scrolling yang mirip manusia
- **Batch Mode** - Registrasi banyak akun sekaligus
- **Auto Retry** - Retry otomatis jika gagal dengan exponential backoff

## 📋 Persyaratan

- **Node.js** >= 18.x
- **npm** atau **yarn**
- Proxy list (sangat disarankan)
- (Opsional) Kopeechka API key untuk temp mail paling reliable

## 🛠️ Instalasi

```bash
# Clone atau copy project
cd auto-regist-magnific

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy dan edit konfigurasi
cp .env.example .env
nano .env
```

## ⚙️ Konfigurasi

### File `.env`

```env
# Proxy
PROXY_MODE=file              # file, single, rotating_service
PROXY_URL=socks5://user:pass@host:port

# Temp Mail Provider
TEMP_MAIL_PROVIDER=mail_tm   # mail_tm, guerrilla, kopeechka
KOPEECHKA_API_KEY=           # Jika pakai kopeechka

# Registration
BATCH_COUNT=5
REGISTRATION_DELAY=15000
MAX_RETRIES=3

# Browser
HEADLESS=true

# Output
OUTPUT_FILE=api_keys.txt
```

### File `proxies.txt`

```text
# Satu proxy per baris
# Format: protocol://user:pass@host:port
socks5://user:pass@1.2.3.4:1080
http://user:pass@5.6.7.8:8080
http://9.10.11.12:3128
```

## 🚀 Penggunaan

### Mode Single (1 Akun)

```bash
# Registrasi 1 akun
npm start

# Atau langsung
node src/index.js
```

### Mode Batch (Banyak Akun)

```bash
# Registrasi 5 akun
node src/index.js --mode=batch --count=5

# Dengan concurrency (hati-hati rate limit)
node src/index.js --mode=batch --count=10 --concurrency=2
```

### CLI Options

```bash
node src/index.js --help

Options:
  -m, --mode <mode>          Mode: register atau batch (default: "register")
  -c, --count <number>       Jumlah akun untuk batch mode (default: "5")
  --concurrency <number>     Registrasi bersamaan (default: "1")
  --provider <name>          Temp mail: mail_tm, guerrilla, kopeechka
  --proxy <url>              Single proxy URL
  --no-headless              Jalankan dengan browser visible (untuk debug)
  --output <file>            File output API keys
  -h, --help                 Tampilkan bantuan
```

### Contoh Penggunaan

```bash
# Single dengan proxy tertentu
node src/index.js --proxy="socks5://user:pass@1.2.3.4:1080"

# Batch 10 akun dengan kopeechka (paling reliable)
node src/index.js --mode=batch --count=10 --provider=kopeechka

# Debug mode (browser visible)
node src/index.js --no-headless

# Custom output file
node src/index.js --mode=batch --count=5 --output="keys_output.txt"
```

## 📁 Struktur Project

```
auto-regist-magnific/
├── src/
│   ├── index.js                    # Main entry point + CLI
│   ├── config.js                   # Configuration loader
│   ├── browser/
│   │   ├── browser-manager.js      # Anti-detect browser session
│   │   └── fingerprint.js          # Fingerprint generation & injection
│   ├── mail/
│   │   ├── index.js                # Mail factory with fallback
│   │   ├── mail-tm.js              # Mail.tm provider (gratis)
│   │   ├── guerrilla-mail.js       # Guerrilla Mail provider (gratis)
│   │   └── kopeechka.js            # Kopeechka provider (berbayar)
│   ├── proxy/
│   │   └── index.js                # Proxy manager with rotation
│   ├── registration/
│   │   ├── register.js             # Registration automation
│   │   └── api-key-extractor.js    # API key extraction
│   └── utils/
│       ├── helpers.js              # Utility functions
│       └── logger.js               # Winston logger
├── logs/                           # Log files & screenshots
├── proxies.txt                     # Proxy list
├── api_keys.txt                    # Output: extracted API keys
├── .env.example                    # Config template
├── .env                            # Your config (gitignored)
├── package.json
└── README.md
```

## 🔑 Output Format

API keys disimpan di `api_keys.txt` dengan format:

```
[2025-01-15T10:30:45.123Z]
Email: randomuser123@domain.com
Password: xK9#mP2$nQ7wL4
API Key: mk_live_abc123def456ghi789...
============================================================

[2025-01-15T10:35:12.456Z]
Email: anotheruser456@domain.com
Password: hT5@jR8&vB3mN6
API Key: mk_live_xyz789abc123def456...
============================================================
```

## 🛡️ Anti-Detect Features

### Browser Fingerprint Spoofing
- ✅ Random User-Agent (Chrome versi terbaru, multi-platform)
- ✅ WebGL Vendor & Renderer spoofing
- ✅ Canvas fingerprint noise injection
- ✅ AudioContext spoofing
- ✅ Screen resolution randomization
- ✅ Timezone spoofing + matching geolocation
- ✅ Navigator properties (platform, hardwareConcurrency, deviceMemory)
- ✅ Battery API spoofing
- ✅ Connection API spoofing
- ✅ Plugin/mime-type injection
- ✅ WebDriver flag removal
- ✅ Chrome runtime mock

### Human-Like Behavior
- ✅ Variable typing speed (50-150ms per karakter)
- ✅ Occasional typos + correction (3% chance)
- ✅ Random pauses saat mengetik
- ✅ Mouse movement dengan bezier curve
- ✅ Random scrolling setelah page load
- ✅ Random delays antar aksi

### Proxy & Network
- ✅ HTTP/HTTPS/SOCKS4/SOCKS5 support
- ✅ Round-robin rotation dengan cooldown
- ✅ Auto-blacklist dead proxies
- ✅ Per-proxy usage tracking
- ✅ Proxy health monitoring

## 📧 Temp Mail Providers

| Provider | Tipe | Reliability | Catatan |
|----------|------|-------------|---------|
| **Kopeechka** | Berbayar | ⭐⭐⭐⭐⭐ | Domain real, paling jarang diblock |
| **Mail.tm** | Gratis | ⭐⭐⭐⭐ | API bagus, kadang diblock |
| **Guerrilla Mail** | Gratis | ⭐⭐⭐ | Fallback, domain terkenal |

### Rekomendasi:
- Untuk **hasil terbaik**: Gunakan **Kopeechka** (domain real, tidak diblock magnific)
- Untuk **gratis**: Gunakan **Mail.tm** (paling stabil dari yang gratis)
- Tool akan otomatis fallback ke provider lain jika satu gagal

## ⚠️ Tips & Troubleshooting

### Proxy Wajib!
Tanpa proxy, IP kamu akan cepat diblokir. Gunakan minimal 10-20 proxy untuk batch mode.

### Delay Antar Registrasi
Jangan set delay terlalu kecil. Minimal 10-15 detik antar registrasi.

### Kopeechka untuk Get API Key
Jika sering gagal di tahap get API key, kemungkinan email temp diblock. Gunakan Kopeechka yang pakai domain real.

### Debug Mode
Jika gagal, jalankan dengan `--no-headless` untuk melihat apa yang terjadi di browser.

### Error Umum
- `"All mail providers failed"` → Cek koneksi internet/proxy
- `"Could not find email input"` → Magnific mungkin ganti layout, update selectors
- `"API key extraction failed"` → Login berhasil tapi halaman API berubah
- `"Proxy blacklisted"` → Semua proxy mati, tambah proxy baru

## 📝 Catatan Penting

- Tool ini untuk **keperluan edukasi dan development**
- Gunakan secara **bertanggung jawab**
- Hormati **Terms of Service** dari setiap layanan
- Jangan melakukan spam atau abuse
- Proxy berkualitas sangat mempengaruhi tingkat keberhasilan

## 📄 License

MIT License
