# Email Handler

English | [Indonesian](README_id.md)

![email-handler](https://github.com/user-attachments/assets/538b2ab3-fc5d-4738-994a-c404059ceb2c)

A serverless Cloudflare Email Worker that parses incoming emails, stores them in D1, and posts a human-readable summary to Discord via webhook.

## Features

- **Email parsing**: Parses raw MIME with `postal-mime`, extracts text from HTML, and detects OTP codes.
- **Sender blocklist**: Rejects emails from specific addresses or domain patterns (supports `*` wildcard, configured via env vars).
- **D1 storage**: Stores full email data (sender, recipient, subject, body text, body HTML, raw MIME) in Cloudflare D1.
- **Discord notification**: Posts a `.txt` summary with embedded OTP codes to a Discord webhook on each received email.
- **REST API**: Hono-based JSON API with bearer token auth for listing, searching, fetching, and deleting emails.

## How It Works

On each incoming email:

1. Raw MIME is parsed; sender is checked against the blocklist — rejected emails get `setReject`.
2. Text is extracted from HTML body (with entity decoding); OTP codes are detected.
3. Full email is saved to D1.
4. A `.txt` summary is built and uploaded to Discord as a file attachment with OTP codes in the embed.

## Configuration

### Environment Variables

| Variable              | Description                                             | Required |
| --------------------- | ------------------------------------------------------- | -------- |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for email notifications             | Yes      |
| `FALLBACK_EMAIL`      | Fallback recipient address if processing fails          | Yes      |
| `API_TOKEN`           | Bearer token for REST API authentication                | Yes      |
| `BLOCKED_EMAILS`      | Comma-separated exact sender addresses to block         | No       |
| `BLOCK_PATTERNS`      | Comma-separated domain patterns to block (`*` wildcard) | No       |

Example `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
FALLBACK_EMAIL=you@example.com
API_TOKEN=your-secret-token-here
BLOCKED_EMAILS=spam@example.com,scam@test.com
BLOCK_PATTERNS=spam.com,*.spam.com
```

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

## REST API

All endpoints require `Authorization: Bearer <API_TOKEN>` header.

### `GET /api/email`

List emails with pagination and search.

**Query params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `search` (optional, searches subject and sender)

**Response:**
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### `GET /api/email/:id`

Fetch a single email by ID.

**Response:**
```json
{
  "data": {
    "id": 1,
    "recipient": "you@example.com",
    "sender": "sender@example.com",
    "subject": "Hello",
    "body_text": "...",
    "body_html": "...",
    "received_at": "2026-09-29T10:00:00.000Z"
  }
}
```

### `DELETE /api/email/:id`

Delete a single email.

**Response:**
```json
{ "success": true }
```

### `DELETE /api/email`

Bulk delete multiple emails.

**Body:**
```json
[1, 2, 3]
```

**Response:**
```json
{ "success": true, "deleted": 3 }
```

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

## Scripts

```bash
pnpm dev          # Local dev via wrangler
pnpm deploy       # Deploy to Cloudflare
pnpm deploy-min   # Deploy with minification
pnpm cf-typegen   # Generate Cloudflare binding types
```

## Stack

- Cloudflare Workers (Hono framework)
- Cloudflare D1 (SQLite)
- `postal-mime` for email parsing
- `@hono/zod-validator` + `zod` for request validation

