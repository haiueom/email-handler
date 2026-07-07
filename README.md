# Email Handler

English | [Indonesian](README_id.md)

![email-handler](https://github.com/user-attachments/assets/538b2ab3-fc5d-4738-994a-c404059ceb2c)

A serverless Cloudflare Email Worker that parses incoming emails, stores them in D1, forwards a summary to Discord via webhook, and provides a web dashboard to browse and manage received emails.

## Features

- **Email parsing**: Parses raw MIME with `postal-mime` and extracts text, links, and attachments from HTML bodies via `cheerio`.
- **Blocklist**: Rejects emails from specific addresses or domain patterns (supports `*` wildcard) before processing.
- **D1 storage**: Stores full email data (sender, recipient, subject, body text, body HTML, raw MIME) in a Cloudflare D1 database.
- **Discord notification**: Posts a human-readable `.txt` summary to a Discord webhook on each received email.
- **Web dashboard**: Paginated, searchable email list with per-email detail and delete support.
- **Dual authentication**: Cloudflare Access (JWT) takes priority; falls back to HTTP Basic Auth.

## How It Works

On each incoming email:

1. Raw MIME is parsed; sender is checked against the blocklist — rejected emails get `setReject`.
2. HTML body is stripped and links are extracted.
3. Full email is saved to D1.
4. A `.txt` summary is built and uploaded to Discord as a file attachment.

## Configuration

### Environment Variables (`.vars` / Secrets)

| Variable              | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for email notifications             |
| `DASHBOARD_URL`       | Public URL of the deployed worker                       |
| `DASHBOARD_USER`      | Basic Auth username for the dashboard                   |
| `DASHBOARD_PASS`      | Basic Auth password for the dashboard                   |
| `FALLBACK_EMAIL`      | Fallback recipient address                              |
| `TEAM_DOMAIN`         | Cloudflare Access team domain (enables JWT auth)        |
| `AUDIENCE_TAG`        | Cloudflare Access audience tag (required with JWT auth) |

> If `TEAM_DOMAIN` and `AUDIENCE_TAG` are set, Cloudflare Access JWT auth is used and Basic Auth is ignored.

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
// Exact address block
export const BLOCKED_EMAILS: string[] = ['spammer@example.com'];

// Domain/pattern block (* is a wildcard)
export const BLOCK_PATTERNS: string[] = [
  'spam.com',
  '*.spam.com',
];
```

## Dashboard

The dashboard is served at `/` and requires authentication. It provides:

- Paginated email list with server-side search (by subject or sender)
- Per-email detail view with sanitized HTML rendering
- Delete individual emails

## Scripts

```bash
pnpm dev          # Local dev via wrangler
pnpm deploy       # Deploy to Cloudflare
pnpm deploy-min   # Deploy with minification
pnpm cf-typegen   # Generate Cloudflare binding types
```

