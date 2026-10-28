# Email Handler

English | [Indonesian](README_id.md)

![email-handler](https://github.com/user-attachments/assets/538b2ab3-fc5d-4738-994a-c404059ceb2c)

A serverless Cloudflare Email Worker that parses incoming emails, stores them in D1, and sends notifications to Discord and Telegram.

## Features

- **Email parsing**: Parses raw MIME with `postal-mime`, extracts text from HTML, and detects OTP codes.
- **Sender blocklist**: Rejects emails from specific addresses or domain patterns (supports `*` wildcard, configured via env vars).
- **D1 storage**: Stores full email data (sender, recipient, subject, body text, body HTML, raw MIME) in Cloudflare D1.
- **Discord notification**: Posts a `.txt` summary with embedded OTP codes to a Discord webhook.
- **Telegram notification**: Posts a summary to a Telegram chat via bot API.

## How It Works

On each incoming email:

1. Raw MIME is parsed; sender is checked against the blocklist — rejected emails get `setReject`.
2. Text is extracted from HTML body (robust against attributes, script/style, and comments; with entity decoding); OTP codes are detected.
3. Full email is saved to D1.
4. A `.txt` summary is built and sent to Discord/Telegram with OTP codes highlighted.
5. On error, raw email is forwarded to `FALLBACK_EMAIL` if configured.

## Configuration

### Environment Variables

| Variable              | Description                                             | Required |
| --------------------- | ------------------------------------------------------- | -------- |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for email notifications             | No       |
| `TELEGRAM_BOT_TOKEN`  | Telegram bot token from @BotFather                      | No       |
| `TELEGRAM_CHAT_ID`    | Telegram chat ID to post notifications to               | No       |
| `FALLBACK_EMAIL`      | Fallback recipient address if processing fails          | Yes      |
| `BLOCKED_EMAILS`      | Comma-separated exact sender addresses to block         | No       |
| `BLOCK_PATTERNS`      | Comma-separated domain patterns to block (`*` wildcard) | No       |

> Discord and Telegram are both optional. If neither is configured, emails are stored in D1 without a notification.

Example `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
FALLBACK_EMAIL=you@example.com
BLOCKED_EMAILS=spam@example.com,scam@test.com
BLOCK_PATTERNS=spam.com,*.spam.com
```

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A domain added to Cloudflare (for email routing)

### 1. Clone and install

```bash
git clone https://github.com/haiueom/email-handler.git
cd email-handler
pnpm install
```

### 2. Create D1 database

```bash
wrangler d1 create email-db
```

Copy the `database_id` from the output and replace it in `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "email-db",
    "database_id": "<your-database-id>"
  }
]
```

### 3. Initialize the database schema

For local development:

```bash
wrangler d1 execute email-db --local --file=schema.sql
```

For production:

```bash
wrangler d1 execute email-db --remote --file=schema.sql
```

### 4. Configure environment variables

Create a `.dev.vars` file for local development:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
FALLBACK_EMAIL=you@example.com
```

For production, set secrets via Wrangler:

```bash
wrangler secret put DISCORD_WEBHOOK_URL
wrangler secret put FALLBACK_EMAIL

# Optional:
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put BLOCKED_EMAILS
wrangler secret put BLOCK_PATTERNS
```

### 5. Local development

```bash
pnpm dev
```

### 6. Deploy

```bash
pnpm deploy
```

### 7. Configure email routing

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → your domain → **Email** → **Email Routing**.
2. Enable Email Routing for your domain.
3. Under **Routing rules**, create a rule that routes your desired address (e.g. `catch-all` or a specific address) to the `email-handler` Worker.

## Database Schema

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

## CI

GitHub Actions runs typecheck, Prettier, and tests on push/PR to `main`/`master` (see `.github/workflows/ci.yml`).

## Scripts

```bash
pnpm dev          # Local dev via wrangler
pnpm deploy       # Deploy to Cloudflare
pnpm deploy-min   # Deploy with minification
pnpm cf-typegen   # Generate Cloudflare binding types
pnpm typecheck    # Run TypeScript type checks
pnpm test         # Run unit tests (Vitest)
pnpm precommit    # Run TypeScript + Prettier checks
```
