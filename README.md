# Email Handler

A serverless Cloudflare Email Worker that parses incoming emails, stores them in KV, tracks a simple processed-email count, and posts a human-readable `.txt` summary to Discord via webhook.

## Features

- **Email Parsing & Storage**
  Parses raw MIME (via `postal-mime`) and saves full message JSON under `recipient-key` in Cloudflare KV.
- **Statistics Counter**
  Increments and persists a `stats-count` key in KV for each processed email.
- **Discord Attachment**
  Generates a `.txt` summary (from, to, key, date, subject, body) and uploads it to Discord as a file attachment.

## How It Works

On each incoming email:

1. Worker parses MIME and extracts metadata (from, to, subject, date, body).
2. Increments stats-count in KV.
3. Stores full JSON under recipient-key.
4. Builds a .txt summary:

```yaml
Salin
Edit
📤 From    : sender@example.com
📥 To      : you@domain.com
🔐 Key     : ab12cd34
📅 Date    : 4/24/2025, 3:15:07 PM
🧾 Subject : Hello World

💌 Message :
This is the email body…
```
5. Posts that .txt file to Discord via the configured webhook.
6. Errors are logged to the worker console.

## Configuration

| Environment Variable | Description                      |
|----------------------|----------------------------------|
| `DC_WEBHOOK`         | Discord webhook URL              |
| `MAIL_DB`            | Cloudflare KV namespace binding  |

In `wrangler.toml` or Dashboard:

```toml
[env.production]
vars = { DC_WEBHOOK = "https://discord.com/api/webhooks/…" }
kv_namespaces = [
  { binding = "MAIL_DB", id = "your-kv-namespace-id" }
]
```
