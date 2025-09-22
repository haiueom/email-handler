DROP TABLE IF EXISTS emails;
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

-- create the database with:
-- wrangler d1 execute email-db --local --command "CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY, recipient TEXT, sender TEXT, subject TEXT, body_text TEXT, body_html TEXT, raw_email TEXT, received_at TEXT DEFAULT CURRENT_TIMESTAMP);"
