# Email Handler

Indonesia | [Inggris](README.md)

![email-handler](https://github.com/user-attachments/assets/538b2ab3-fc5d-4738-994a-c404059ceb2c)

Sebuah Cloudflare Email Worker serverless yang mengurai email masuk, menyimpannya di D1, mengirimkan ringkasan ke Discord melalui webhook, dan menyediakan dasbor web untuk melihat dan mengelola email yang diterima.

## Fitur Utama

- **Penguraian email**: Mengurai MIME mentah dengan `postal-mime` dan mengekstrak teks, tautan, serta lampiran dari body HTML menggunakan `cheerio`.
- **Blocklist**: Menolak email dari alamat tertentu atau pola domain (mendukung wildcard `*`) sebelum diproses.
- **Penyimpanan D1**: Menyimpan data email lengkap (pengirim, penerima, subjek, body teks, body HTML, MIME mentah) di database Cloudflare D1.
- **Notifikasi Discord**: Mengirimkan ringkasan `.txt` yang mudah dibaca ke Discord webhook untuk setiap email yang diterima.
- **Dasbor web**: Daftar email dengan paginasi dan pencarian, lengkap dengan tampilan detail, hapus satu email, dan hapus banyak email sekaligus (multi-select).
- **Autentikasi Cloudflare Access**: Dasbor dilindungi eksklusif oleh Cloudflare Access (JWT). Tidak ada metode autentikasi lain yang diterima.

## Cara Kerja

Pada setiap email masuk:

1. MIME mentah diurai; pengirim dicek terhadap blocklist — email yang diblokir akan di-reject dengan `setReject`.
2. Body HTML dibersihkan dan tautan diekstrak.
3. Email lengkap disimpan ke D1.
4. Ringkasan `.txt` dibuat dan diunggah ke Discord sebagai lampiran file.

## Konfigurasi

### Variabel Lingkungan (`.vars` / Secrets)

| Variabel              | Deskripsi                                                    |
| --------------------- | ------------------------------------------------------------ |
| `DISCORD_WEBHOOK_URL` | URL Discord webhook untuk notifikasi email                   |
| `DASHBOARD_URL`       | URL publik worker yang sudah di-deploy                       |
| `FALLBACK_EMAIL`      | Alamat email penerima cadangan                               |
| `TEAM_DOMAIN`         | Team domain Cloudflare Access (wajib)                        |
| `AUDIENCE_TAG`        | Audience tag Cloudflare Access (wajib)                       |

> `TEAM_DOMAIN` dan `AUDIENCE_TAG` keduanya wajib diisi. Dasbor mengembalikan `503` jika salah satunya tidak dikonfigurasi.

### `wrangler.jsonc`

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "email-db",
    "database_id": "your-d1-database-id"
  }
]
```

### Blocklist (`src/blocklist.ts`)

```ts
// Blokir alamat spesifik
export const BLOCKED_EMAILS: string[] = ['spammer@example.com'];

// Blokir domain/pola (* adalah wildcard)
export const BLOCK_PATTERNS: string[] = [
  'spam.com',
  '*.spam.com',
];
```

## Dasbor

Dasbor tersedia di `/` dan memerlukan autentikasi. Fitur yang tersedia:

- Daftar email dengan paginasi dan pencarian server-side (berdasarkan subjek atau pengirim)
- Tampilan detail per email dengan rendering HTML yang sudah disanitasi
- Pilih beberapa email sekaligus dengan checkbox dan hapus dalam satu aksi (bulk delete)
- Hapus email individual dari daftar maupun tampilan detail

## Scripts

```bash
pnpm dev          # Dev lokal via wrangler
pnpm deploy       # Deploy ke Cloudflare
pnpm deploy-min   # Deploy dengan minifikasi
pnpm cf-typegen   # Generate tipe binding Cloudflare
```

