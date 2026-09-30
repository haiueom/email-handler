# AGENTS.md

## Stack

- **Runtime**: Cloudflare Workers (Hono v4)
- **Database**: Cloudflare D1 (SQLite)
- **Email parsing**: `postal-mime` v3
- **Validation**: `@hono/zod-validator` + `zod` v4
- **API docs**: `@hono/zod-openapi` (OpenAPI 3.0 spec) + `@scalar/hono-api-reference` (interactive docs UI)
- **TypeScript**: v7

## Project Structure

```
email-handler/
├── src/
│   ├── index.ts              # Main worker entry (fetch + email handlers)
│   ├── email.ts              # Email handler (parse, filter, store, notify)
│   ├── db.ts                 # D1 operations (saveEmail)
│   ├── parser.ts             # HTML text extraction, OTP detection, summary formatting
│   ├── discord.ts            # Discord webhook notification
│   ├── filter.ts             # Sender blocklist logic
│   ├── types.ts              # TypeScript types
│   ├── routes/
│   │   └── emails.ts         # REST API routes (list, get, delete)
│   └── middleware/
│       ├── auth.ts           # Bearer token authentication
│       └── error-handler.ts  # Global error handler
├── schema.sql                # D1 database schema
├── wrangler.jsonc            # Cloudflare Workers config
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
7. **Send to Discord** via `ctx.waitUntil()` — embeds OTP codes if detected
8. **Fallback**: On error, forwards raw email to `FALLBACK_EMAIL` if configured

### REST API

- **Framework**: Hono v4 with `OpenAPIHono` (App Router pattern)
- **Auth**: Bearer token via `hono/bearer-auth` middleware on `/api/*`
- **Routes**: Mounted in `src/index.ts` as `app.route('/api/email', emails)`
- **Validation**: Zod schemas with `@hono/zod-validator` → now via `createRoute` in `src/routes/emails.ts`
- **Schemas**: All request/response Zod schemas live in `src/schemas.ts`
- **Docs**: OpenAPI spec at `GET /openapi.json`, Scalar UI at `GET /docs` (both public)

### OTP Detection

`extractOtpCodes(text)` in `src/parser.ts`:
- Matches 4-8 digit codes near keywords (`verification`, `otp`, `code`, `pin`)
- Excludes phone numbers (country code prefix, phone/mobile/cell context)
- Excludes codes embedded in larger numbers
- Works on both plain text and HTML-extracted text

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
```

## Environment Variables

All configured in Wrangler secrets or `.dev.vars`:

| Variable              | Type     | Usage                                  |
| --------------------- | -------- | -------------------------------------- |
| `DB`                  | Binding  | D1 database (configured in wrangler)   |
| `DISCORD_WEBHOOK_URL` | Secret   | Discord webhook for notifications      |
| `FALLBACK_EMAIL`      | Secret   | Fallback recipient on processing error |
| `API_TOKEN`           | Secret   | Bearer token for REST API auth         |
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

## API Authentication

All `/api/email` routes require:

```
Authorization: Bearer <API_TOKEN>
```

Implemented via `hono/bearer-auth` with `verifyToken` callback in `src/middleware/auth.ts`.

## Error Handling

- Global error handler in `src/middleware/error-handler.ts` returns JSON errors
- Email processing errors log to console and forward to `FALLBACK_EMAIL` if configured
- Discord webhook failures throw with response body included in error message
- API validation errors return 400 with Zod error details

## Type Safety

- `worker-configuration.d.ts` generated from `wrangler.jsonc` via `pnpm cf-typegen`
- Manually augmented with env var types (`DISCORD_WEBHOOK_URL`, `API_TOKEN`, etc.)
- Hono context typed as `Context<{ Bindings: Env }>` for env access
- D1 query results typed via `EmailRow` interface

## Testing Locally

1. Create `.dev.vars`:
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
   FALLBACK_EMAIL=you@example.com
   API_TOKEN=test-token
   ```

2. Create local D1 database:
   ```bash
   wrangler d1 execute email-db --local --file=schema.sql
   ```

3. Start dev server:
   ```bash
   pnpm dev
   ```

4. Test email endpoint with curl (requires email routing configured):
   ```bash
   # Send test email to your configured email address
   ```

5. Test REST API:
   ```bash
   curl -H "Authorization: Bearer test-token" http://localhost:8787/api/email
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
   wrangler secret put API_TOKEN
   # Optional:
   wrangler secret put BLOCKED_EMAILS
   wrangler secret put BLOCK_PATTERNS
   ```

3. Deploy:
   ```bash
   pnpm deploy
   ```

4. Configure email routing in Cloudflare dashboard to point to this worker.

## Recent Changes (2026-09-29)

- Removed unused `getEmailById`, `listEmails`, `deleteEmailById` from `db.ts`
- Fixed `EmailRecord` type to properly extend `Email` from postal-mime
- Improved HTML entity decoding (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`)
- Fixed OTP extraction to check both plain text and HTML-extracted body
- Added error response body to Discord webhook failure messages
- Extracted `parseEmailId` helper to deduplicate ID validation
- Moved blocklists from hardcoded arrays to env vars (`BLOCKED_EMAILS`, `BLOCK_PATTERNS`)
- Fixed auth middleware for `hono/bearer-auth` API change (`verifyToken` callback)