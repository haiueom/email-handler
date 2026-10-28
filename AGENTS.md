# AGENTS.md

## Stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Email parsing**: `postal-mime` v4
- **TypeScript**: v7

## Project Structure

```
email-handler/
├── src/
│   ├── index.ts              # Main worker entry (email handler)
│   ├── email.ts              # Email handler (parse, filter, store, notify)
│   ├── db.ts                 # D1 operations (saveEmail)
│   ├── parser.ts             # HTML text extraction, OTP detection, summary formatting
│   ├── discord.ts            # Discord webhook notification
│   ├── telegram.ts           # Telegram notification
│   ├── filter.ts             # Sender blocklist logic
│   └── types.ts              # TypeScript types
├── schema.sql                # D1 database schema
├── wrangler.jsonc            # Cloudflare Workers config
├── .pre-commit-config.yaml   # Pre-commit hooks
├── .github/workflows/ci.yml  # CI workflow
├── tests/                    # Unit tests (Vitest)
└── worker-configuration.d.ts # Generated types (wrangler types)
```

## Architecture

### Email Flow

1. **Incoming email** triggers `handleEmail(message, env, ctx)` in `src/email.ts`
2. **Parse MIME** with `postal-mime`
3. **Check blocklist** via `isSenderBlocked(sender, env)` — rejects with `message.setReject()` if blocked
4. **Extract text**: Prefers `parsedEmail.text`, falls back to `extractTextFromHtml(html)` for HTML-only emails
5. **Save to D1** via `saveEmail()` — returns row ID
6. **Build summary** with `buildEmailSummary()` — formats as plain text
7. **Send notifications** via `ctx.waitUntil()` — Discord (embed + OTP), Telegram (HTML message + OTP)
8. **Fallback**: On error, forwards raw email to `FALLBACK_EMAIL` if configured

### OTP Detection

`extractOtpCodes(text)` in `src/parser.ts`:

- Matches 4-8 digit codes near keywords (`verification`, `otp`, `code`, `pin`)
- Excludes phone numbers (country code prefix, phone/mobile/cell context)
- Excludes codes embedded in larger numbers
- Works on both plain text and HTML-extracted text

`extractTextFromHtml(html)` in `src/parser.ts`:

- Removes tags (including quoted attributes containing `>`), script/style blocks, and comments
- Decodes common HTML entities

### Blocklist

Configured via env vars:

- `BLOCKED_EMAILS`: Comma-separated exact addresses (case-insensitive)
- `BLOCK_PATTERNS`: Comma-separated domain patterns (`*` = wildcard)

Example:

```
BLOCKED_EMAILS=spam@example.com,scam@test.com
BLOCK_PATTERNS=spam.com,*.spam.com
```

Parsed at runtime by `getBlockedEmails(env)` and `getBlockPatterns(env)` in `src/filter.ts`.

## Commands

```bash
pnpm dev          # Start local dev server (wrangler dev)
pnpm deploy       # Deploy to Cloudflare Workers
pnpm deploy-min   # Deploy with minification
pnpm cf-typegen   # Regenerate worker-configuration.d.ts from wrangler.jsonc
pnpm typecheck    # Run TypeScript type checks
pnpm test         # Run unit tests (Vitest)
pnpm precommit    # Run TypeScript + Prettier checks
```

## Environment Variables

All configured in Wrangler secrets or `.dev.vars`:

| Variable              | Type     | Usage                                  |
| --------------------- | -------- | -------------------------------------- |
| `DB`                  | Binding  | D1 database (configured in wrangler)   |
| `DISCORD_WEBHOOK_URL` | Optional | Discord webhook for notifications      |
| `TELEGRAM_BOT_TOKEN`  | Optional | Telegram bot token from @BotFather     |
| `TELEGRAM_CHAT_ID`    | Optional | Telegram chat ID for notifications     |
| `FALLBACK_EMAIL`      | Secret   | Fallback recipient on processing error |
| `BLOCKED_EMAILS`      | Optional | Comma-separated sender addresses       |
| `BLOCK_PATTERNS`      | Optional | Comma-separated domain patterns        |

## Database

Schema in `schema.sql`:

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

## Error Handling

- Email processing errors log to console and forward to `FALLBACK_EMAIL` if configured
- Blocked senders are rejected even when parsing fails (best-effort sender extraction from raw headers)
- Discord webhook failures throw with response body included in error message

## Type Safety

- `worker-configuration.d.ts` generated from `wrangler.jsonc` via `pnpm cf-typegen`
- Manually augmented with env var types (`DISCORD_WEBHOOK_URL`, etc.)
- D1 query results typed via `EmailRow` interface

## Testing Locally

1. Create `.dev.vars`:

    ```
    DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
    FALLBACK_EMAIL=you@example.com
    ```

2. Create local D1 database:

    ```bash
    wrangler d1 execute email-db --local --file=schema.sql
    ```

3. Start dev server:
    ```bash
    pnpm dev
    ```

## Deployment

1. Create production D1 database:

    ```bash
    wrangler d1 create email-db
    # Copy database_id to wrangler.jsonc
    wrangler d1 execute email-db --remote --file=schema.sql
    ```

2. Set secrets:

    ```bash
    wrangler secret put DISCORD_WEBHOOK_URL
    wrangler secret put FALLBACK_EMAIL
    # Optional:
    wrangler secret put BLOCKED_EMAILS
    wrangler secret put BLOCK_PATTERNS
    ```

3. Deploy:

    ```bash
    pnpm deploy
    ```

4. Configure email routing in Cloudflare dashboard to point to this worker.
