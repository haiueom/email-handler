# Email Handler

Indonesia | [Inggris](README.md)

![email-handler](https://github.com/user-attachments/assets/538b2ab3-fc5d-4738-994a-c404059ceb2c)

Sebuah Cloudflare Email Worker serverless yang mengurai email masuk, menyimpannya di KV, melacak jumlah email yang diproses, dan mengirimkan ringkasan .txt yang mudah dibaca ke Discord melalui webhook.

## Fitur Utama

- **Penguraian & Penyimpanan Email**: Mengurai MIME mentah (melalui postal-mime) dan menyimpan pesan lengkap dalam format JSON di bawah kunci-penerima (recipient-key) di Cloudflare KV.
- **Penghitung Statistik**: Menaikkan dan menyimpan key stats-count di KV untuk setiap email yang diproses.
- **Lampiran Discord**: Menghasilkan ringkasan .txt (dari, ke, kunci, tanggal, subjek, isi) dan mengunggahnya ke Discord sebagai lampiran file.

## Konfigurasi

1. `.env`

| Environment Variable  | Deskripsi           |
| --------------------- | ------------------- |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL |

2. `wrangler.toml`

```toml
[env.production]
vars = { DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/…" }
kv_namespaces = [
	{ binding = "EMAIL_KV", id = "your-kv-namespace-id" }
]
```

## Bgaimana Cara Kerjanya

Pada setiap email masuk:

1. Worker mengurai MIME dan mengekstrak metadata (dari, ke, subjek, tanggal, isi).
2. Menaikkan stats-count di KV.
3. Menyimpan JSON lengkap di bawah recipient-key.
4. Membangun ringkasan .txt:

```txt
📤 From    : sender@example.com
📥 To      : you@domain.com
🔐 Key     : ab12cd34
📅 Date    : 4/24/2025, 3:15:07 PM
🧾 Subject : Hello World

🔗 Links   :
- https://example.com

💌 Message :
This is the email body…
```

5. Mengirim file .txt tersebut ke Discord melalui webhook yang telah dikonfigurasi.
6. Kesalahan dicatat di konsol worker.
