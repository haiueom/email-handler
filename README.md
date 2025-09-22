# Email Handler

English | [Indonesian](README_id.md)

![email-handler](https://github.com/user-attachments/assets/538b2ab3-fc5d-4738-994a-c404059ceb2c)

A serverless Cloudflare Email Worker that parses incoming emails, stores them in D1, and posts a human-readable `.txt` summary to Discord via webhook.

## How It Works

On each incoming email:

1. Worker parses MIME and extracts metadata (from, to, subject, date, body).
2. Stores email to D1 storage.
3. Create a summary `email.txt` like the example below and send it to Discord Webhook.

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

## Configuration

1. `.vars`

| Environment Variable  | Description         |
| --------------------- | ------------------- |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL |
| `DASHBOARD_USER`      | Dashboard username  |
| `DASHBOARD_PASS`      | Dashboard password  |

2. `wrangler.jsonc`

```jsonc
// Bind a D1 Database.
// Docs: https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "email-db",
    "database_id": "your-d1-database-id"
  }
]
```
