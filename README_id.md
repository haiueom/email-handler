# Email Handler

Indonesia | [Inggris](README.md)

![email-handler](https://github.com/user-attachments/assets/538b2ab3-fc5d-4738-994a-c404059ceb2c)

Cloudflare Email Worker serverless yang mengurai email masuk, menyimpannya di D1, dan mengirimkan notifikasi ke Discord dan Telegram.

## Fitur Utama

- **Penguraian email**: Mengurai MIME mentah dengan `postal-mime`, mengekstrak teks dari HTML, dan mendeteksi kode OTP.
- **Blocklist pengirim**: Menolak email dari alamat tertentu atau pola domain (mendukung wildcard `*`, dikonfigurasi via env vars).
- **Penyimpanan D1**: Menyimpan data email lengkap (pengirim, penerima, subjek, body teks, body HTML, MIME mentah) di Cloudflare D1.
- **Notifikasi Discord**: Mengirimkan ringkasan `.txt` dengan kode OTP ke Discord webhook.
- **Notifikasi Telegram**: Mengirimkan ringkasan ke chat Telegram via bot API.

## Cara Kerja

Pada setiap email masuk:

1. MIME mentah diurai; pengirim dicek terhadap blocklist — email yang diblokir akan di-reject dengan `setReject`.
2. Teks diekstrak dari body HTML (dengan decoding entity); kode OTP dideteksi.
3. Email lengkap disimpan ke D1.
4. Ringkasan `.txt` dibuat dan dikirim ke Discord/Telegram dengan kode OTP yang disorot.
5. Jika terjadi error, email mentah diteruskan ke `FALLBACK_EMAIL` jika dikonfigurasi.

## Konfigurasi

### Variabel Lingkungan

| Variabel              | Deskripsi                                                    | Wajib |
| --------------------- | ------------------------------------------------------------ | ----- |
| `DISCORD_WEBHOOK_URL` | URL Discord webhook untuk notifikasi email                   | Tidak |
| `TELEGRAM_BOT_TOKEN`  | Token bot Telegram dari @BotFather                           | Tidak |
| `TELEGRAM_CHAT_ID`    | ID chat Telegram untuk notifikasi                            | Tidak |
| `FALLBACK_EMAIL`      | Alamat email penerima cadangan jika pemrosesan gagal         | Ya    |
| `BLOCKED_EMAILS`      | Alamat pengirim yang diblokir, dipisahkan koma               | Tidak |
| `BLOCK_PATTERNS`      | Pola domain yang diblokir, dipisahkan koma (wildcard `*`)    | Tidak |

> Discord dan Telegram keduanya opsional. Jika tidak ada yang dikonfigurasi, email tetap disimpan di D1 tanpa notifikasi.

Contoh `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
FALLBACK_EMAIL=you@example.com
BLOCKED_EMAILS=spam@example.com,scam@test.com
BLOCK_PATTERNS=spam.com,*.spam.com
```

## Instalasi

### Prasyarat

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- Akun [Cloudflare](https://dash.cloudflare.com/sign-up)
- Domain yang sudah ditambahkan ke Cloudflare (untuk email routing)

### 1. Clone dan install

```bash
git clone https://github.com/haiueom/email-handler.git
cd email-handler
pnpm install
```

### 2. Buat database D1

```bash
wrangler d1 create email-db
```

Salin `database_id` dari output dan ganti di `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "email-db",
    "database_id": "<database-id-anda>"
  }
]
```

### 3. Inisialisasi skema database

Untuk development lokal:

```bash
wrangler d1 execute email-db --local --file=schema.sql
```

Untuk production:

```bash
wrangler d1 execute email-db --remote --file=schema.sql
```

### 4. Konfigurasi variabel lingkungan

Buat file `.dev.vars` untuk development lokal:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
FALLBACK_EMAIL=you@example.com
```

Untuk production, set secret via Wrangler:

```bash
wrangler secret put DISCORD_WEBHOOK_URL
wrangler secret put FALLBACK_EMAIL

# Opsional:
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put BLOCKED_EMAILS
wrangler secret put BLOCK_PATTERNS
```

### 5. Development lokal

```bash
pnpm dev
```

### 6. Deploy

```bash
pnpm deploy
```

### 7. Konfigurasi email routing

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) → domain Anda → **Email** → **Email Routing**.
2. Aktifkan Email Routing untuk domain Anda.
3. Di bagian **Routing rules**, buat rule yang mengarahkan alamat yang diinginkan (misalnya `catch-all` atau alamat tertentu) ke Worker `email-handler`.

## Skema Database

```sql
CREATE TABLE emails (
    id INTEGER PRIMARY KEY,
    recipient TEXT,
    sender TEXT,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    raw_email TEXT,
    received_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Scripts

```bash
pnpm dev          # Dev lokal via wrangler
pnpm deploy       # Deploy ke Cloudflare
pnpm deploy-min   # Deploy dengan minifikasi
pnpm cf-typegen   # Generate tipe binding Cloudflare
```

