import PostalMime, { Email } from 'postal-mime';
import * as cheerio from 'cheerio';

// --- Type Definitions ---

/**
 * Represents a parsed link from the email body.
 */
interface Link {
	href?: string;
	text: string;
}

/**
 * Represents the structured data of a parsed email record to be saved.
 */
interface EmailRecord extends Email {
	key: string;
}

// --- Helper Functions ---

/**
 * Extracts clean text and all hyperlinks from an HTML string.
 * @param html The HTML content of the email.
 * @returns An object containing the extracted text and an array of links.
 */
function extractTextAndLinks(html: string): { text: string; links: Link[] } {
	const $ = cheerio.load(html);

	// Remove tags that don't contribute to readable content
	$('style, script, head, title').remove();

	const text = $('body').text().replace(/\s\s+/g, ' ').trim();

	const links = $('a')
		.map((_, el): Link => ({
			href: $(el).attr('href'),
			text: $(el).text().trim(),
		}))
		.get();

	return { text, links };
}

/**
 * Increments the total email count in the KV namespace.
 * @param db The KV namespace binding.
 * @returns The next email count.
 */
async function incrementMailCount(db: KVNamespace): Promise<number> {
	const currentCountStr = (await db.get('stats-count')) || '0';
	const nextCount = parseInt(currentCountStr, 10) + 1;
	await db.put('stats-count', String(nextCount));
	return nextCount;
}

/**
 * Saves the full parsed email data to the KV namespace.
 * @param db The KV namespace binding.
 * @param recipient The primary recipient's email address.
 * @param key The unique key for this email.
 * @param data The email data to store.
 */
async function saveEmail(
	db: KVNamespace,
	recipient: string,
	key: string,
	data: EmailRecord
): Promise<void> {
	await db.put(`${recipient}-${key}`, JSON.stringify(data));
}

/**
 * Sends a text file as an attachment to a Discord webhook.
 * @param text The text content for the file.
 * @param filename The desired filename for the attachment.
 * @param webhook The Discord webhook URL.
 */
async function sendDiscordAttachment(
	text: string,
	filename: string,
	webhook: string
): Promise<void> {
	const form = new FormData();
	form.append('file', new Blob([text], { type: 'text/plain' }), filename);

	const response = await fetch(webhook, { method: 'POST', body: form });

	if (!response.ok) {
		const errorText = await response.text();
		console.error(`Discord webhook failed with status ${response.status}: ${errorText}`);
	}
}

/**
 * Parses a raw email message from a buffer.
 * @param rawBuffer The ArrayBuffer containing the raw email.
 * @returns The parsed email object.
 */
async function parseEmail(rawBuffer: ArrayBuffer): Promise<Email> {
	const parser = new PostalMime();
	return await parser.parse(rawBuffer);
}

/**
 * Creates the content for the Discord message attachment.
 * @param email The parsed email record.
 * @param cleanHtml The extracted text and links from the HTML part.
 * @returns A string formatted for the .txt file.
 */
function createDiscordMessage(email: EmailRecord, cleanHtml: { text: string; links: Link[] }): string {
	const sentDate = email.date ? new Date(email.date) : new Date();
	const humanDate = sentDate.toLocaleString('en-US', { timeZone: 'UTC' });

	const linkLines = cleanHtml.links.length > 0
		? cleanHtml.links.map(link => `- ${link.text} (${link.href || 'No URL'})`).join('\n')
		: '(no links)';

	return [
		`📤 From    : ${email.from.address}`,
		`📥 To      : ${email.to?.[0]?.address ?? 'unknown'}`,
		`🔐 Key     : ${email.key}`,
		`📅 Date    : ${humanDate} (UTC)`,
		`🧾 Subject : ${email.subject || '(no subject)'}`,
		``,
		`🔗 Links   :`,
		linkLines,
		``,
		`💌 Message :`,
		`${email.text || cleanHtml.text || '(no text content)'}`,
	].join('\n');
}

// --- Main Email Handler ---

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		try {
			// 1. Parse the incoming raw email
			const rawBuffer = await new Response(message.raw).arrayBuffer();
			const parsedEmail = await parseEmail(rawBuffer);

			// 2. Increment statistics
			await incrementMailCount(env.EMAIL_KV);

			// 3. Prepare email record for storage
			const recipient = parsedEmail.to?.[0]?.address ?? 'unknown_recipient';
			const key = crypto.randomUUID().substring(0, 8);
			const emailRecord: EmailRecord = { key, ...parsedEmail };

			// 4. Save the full email JSON to KV
			await saveEmail(env.EMAIL_KV, recipient, key, emailRecord);

			// 5. Create and send the Discord notification
			const cleanHtml = extractTextAndLinks(parsedEmail.html || '');
			const discordContent = createDiscordMessage(emailRecord, cleanHtml);
			const filename = `email_${recipient}_${key}.txt`;

			await sendDiscordAttachment(discordContent, filename, env.DISCORD_WEBHOOK_URL);
		} catch (err: unknown) {
			const error = err as Error;
			console.error('Error in email handler:', error.message);
			// Optionally, send a failure notification to another service
		}
	},
};
