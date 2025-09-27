import PostalMime from 'postal-mime';
import * as cheerio from 'cheerio';
import { BLOCKED_EMAILS, BLOCK_PATTERNS } from './blocklist';
import type { EmailRecord, ExtractedContent, ParsedLink } from './types';

// --- Performance Optimizations ---
const BLOCKED_EMAILS_SET = new Set(BLOCKED_EMAILS);
const globToRegex = (pattern: string): RegExp => {
    const escapedPattern = pattern.replace(/([.+?^${}()|[\]\\])/g, '\\$1');
    const regexString = escapedPattern.replace(/\*/g, '.*');
    return new RegExp(`^${regexString}$`);
};
const COMPILED_BLOCK_PATTERNS = BLOCK_PATTERNS.map(globToRegex);

// --- Email-specific Helper Functions ---
function isDomainBlocked(senderDomain: string): boolean {
    for (const regex of COMPILED_BLOCK_PATTERNS) {
        if (regex.test(senderDomain)) return true;
    }
    return false;
}

function extractFromHtml(html: string): ExtractedContent {
    const $ = cheerio.load(html);
    $('style, script, head, title, meta, link').remove();
    const text = $('body').text().replace(/\s\s+/g, ' ').trim();
    const links = $('a')
        .map((_, el): ParsedLink => ({ href: $(el).attr('href'), text: $(el).text().trim() }))
        .get();
    return { text, links };
}

async function saveEmail(db: D1Database, email: Omit<EmailRecord, 'id'>, extractedText: string): Promise<number> {
    const stmt = db.prepare(
        `INSERT INTO emails (recipient, sender, subject, body_text, body_html, raw_email)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const result = await stmt.bind(
        email.to?.[0]?.address ?? 'unknown_recipient',
        email.from?.address ?? 'unknown_sender',
        email.subject || 'No Subject',
        email.text || extractedText || '',
        email.html || '',
        email.raw
    ).run();
    if (!result.success || result.meta.last_row_id === null) {
        throw new Error('Failed to insert email into database.');
    }
    return result.meta.last_row_id;
}

async function sendDiscordNotification(text: string, filename: string, webhookUrl: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', new Blob([text], { type: 'text/plain' }), filename);
    const response = await fetch(webhookUrl, { method: 'POST', body: formData });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Discord webhook failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error('Failed to send Discord notification.');
    }
}

function createDiscordMessage(email: EmailRecord, extractedContent: ExtractedContent): string {
    const sentDate = email.date ? new Date(email.date) : new Date();
    const localDate = sentDate.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
    const linkLines = extractedContent.links.length > 0
        ? extractedContent.links.map(link => `- ${link.text}: ${link.href || 'No URL'}`).join('\n')
        : 'No links found.';
    return `
📤 From: ${email.from.name ? email.from.name : "No Name"} (${email.from.address})
📥 To: ${email.to?.[0].name ? email.to?.[0].name : "No Name"} (${email.to?.[0].address})
🔐 ID: ${email.id}
📅 Date: ${localDate} (UTC+8 / WITA)
🧾 Subject: ${email.subject || '(No Subject)'}

🔗 Links:
${linkLines}

💌 Message:
${email.text || extractedContent.text || '(No text content)'}
  `.trim();
}


/**
 * The primary handler for processing incoming emails.
 */
export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
    try {
        const rawBuffer = await new Response(message.raw).arrayBuffer();
        const parser = new PostalMime();
        const parsedEmail = await parser.parse(rawBuffer);
        const sender = parsedEmail.from?.address;

        if (sender) {
            const lowerCaseSender = sender.toLowerCase();
            const senderDomain = lowerCaseSender.substring(lowerCaseSender.lastIndexOf('@') + 1);
            if (BLOCKED_EMAILS_SET.has(lowerCaseSender) || isDomainBlocked(senderDomain)) {
                console.log(`Blocking email from: ${sender}. Reason: Matched blocklist.`);
                message.setReject('Email blocked by system policy.');
                return;
            }
        }

        const extractedContent = extractFromHtml(parsedEmail.html || '');
        const emailData: Omit<EmailRecord, 'id'> = {
            ...parsedEmail,
            raw: new TextDecoder().decode(rawBuffer),
        };

        const newId = await saveEmail(env.DB, emailData, extractedContent.text);
        const finalEmailRecord: EmailRecord = { ...emailData, id: newId };
        const discordContent = createDiscordMessage(finalEmailRecord, extractedContent);
        const filename = `email-${finalEmailRecord.id}.txt`;
        await sendDiscordNotification(discordContent, filename, env.DISCORD_WEBHOOK_URL);

    } catch (error) {
        console.error('Error in email handler:', error);
        const errorMessage = `Error processing email: ${error instanceof Error ? error.message : String(error)}`;
        await sendDiscordNotification(errorMessage, 'error-notification.txt', env.DISCORD_WEBHOOK_URL);
        try {
            await message.forward("haiueom@gmail.com");
        } catch (forwardError) {
            console.error('Failed to forward the email after error:', forwardError);
        }
    }
}
