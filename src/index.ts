import PostalMime, { type Email } from 'postal-mime';
import * as cheerio from 'cheerio';

// --- Type Definitions ---

/**
 * Represents a parsed link from the email body.
 */
interface ParsedLink {
	href?: string;
	text: string;
}

/**
 * Represents the structured data of a parsed email record.
 * The 'id' is now a number and optional at creation time.
 */
interface EmailRecord extends Omit<Email, 'html'> {
	id?: number; // Will be assigned by the database
	html?: string;
	raw: string;
}

// --- Helper Functions ---

/**
 * Extracts clean text and all hyperlinks from an HTML string.
 * @param html The HTML content of the email.
 * @returns An object containing the extracted text and an array of links.
 */
function extractFromHtml(html: string): { text: string; links: ParsedLink[] } {
	const $ = cheerio.load(html);
	$('style, script, head, title, meta, link').remove();
	const text = $('body').text().replace(/\s\s+/g, ' ').trim();
	const links = $('a')
		.map((_, el): ParsedLink => ({
			href: $(el).attr('href'),
			text: $(el).text().trim(),
		}))
		.get();
	return { text, links };
}

/**
 * Saves the email data to the D1 database and returns the new row ID.
 * @param db The D1 database binding.
 * @param email The email data to store.
 * @returns The auto-incremented ID of the new email record.
 */
async function saveEmail(db: D1Database, email: Omit<EmailRecord, 'id'>): Promise<number> {
	const { to, from, subject, text, html, raw } = email;
	const recipient = to?.[0]?.address ?? 'unknown_recipient';
	const sender = from?.address ?? 'unknown_sender';

	const stmt = db.prepare(
		`INSERT INTO emails (recipient, sender, subject, body_text, body_html, raw_email)
     VALUES (?, ?, ?, ?, ?, ?)`
	);

	const result = await stmt.bind(recipient, sender, subject, text, html, raw).run();

	if (!result.success || result.meta.last_row_id === null) {
		throw new Error('Failed to insert email into database.');
	}

	return result.meta.last_row_id;
}

/**
 * Sends a formatted text file as an attachment to a Discord webhook.
 * @param text The text content for the file.
 * @param filename The desired filename for the attachment.
 * @param webhookUrl The Discord webhook URL from environment variables.
 */
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

/**
 * Creates the content for the Discord message attachment.
 * @param email The parsed email record, including the database ID.
 * @returns A formatted string for the .txt file.
 */
function createDiscordMessage(email: EmailRecord): string {
	const { text: cleanText, links } = extractFromHtml(email.html || '');
	const sentDate = email.date ? new Date(email.date) : new Date();
	const localDate = sentDate.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });

	const linkLines = links.length > 0
		? links.map(link => `- ${link.text}: ${link.href || 'No URL'}`).join('\n')
		: 'No links found.';

	return `
📤 From: ${email.from.address}
📥 To: ${email.to?.[0]?.address ?? 'N/A'}
🔐 ID: ${email.id}
📅 Date: ${localDate} (WITA)
🧾 Subject: ${email.subject || '(No Subject)'}

🔗 Links:
${linkLines}

💌 Message:
${email.text || cleanText || '(No text content)'}
  `.trim();
}

// --- Main Email Handler ---

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		try {
			// 1. Parse the incoming raw email
			const rawBuffer = await new Response(message.raw).arrayBuffer();
			const parser = new PostalMime();
			const parsedEmail = await parser.parse(rawBuffer);

			// 2. Prepare the initial email record (without an ID)
			const emailData: Omit<EmailRecord, 'id'> = {
				...parsedEmail,
				raw: new TextDecoder().decode(rawBuffer),
			};

			// send data email t odiscord for debugging
			await sendDiscordNotification(JSON.stringify(parsedEmail), 'email-debug.txt', env.DISCORD_WEBHOOK_URL);

			// 3. Save the email to D1 and get the new ID
			const newId = await saveEmail(env.DB, emailData);

			// 4. Create the final record and send Discord notification
			const finalEmailRecord: EmailRecord = { ...emailData, id: newId };
			const discordContent = createDiscordMessage(finalEmailRecord);
			const filename = `email-${finalEmailRecord.id}.txt`;
			await sendDiscordNotification(discordContent, filename, env.DISCORD_WEBHOOK_URL);

		} catch (error) {
			console.error('Error in email handler:', error);

			// send a notification to Discord about the error
			const errorMessage = `Error processing email: ${error instanceof Error ? error.message : String(error)}`;
			await sendDiscordNotification(errorMessage, 'error-notification.txt', env.DISCORD_WEBHOOK_URL);

			// Optionally, forward the email to a fallback address
			try {
				// Attempt to forward the email to a fallback address on failure
				await message.forward("haiueom@gmail.com"); // Replace with your fallback email
			} catch (forwardError) {
				console.error('Failed to forward the email after error:', forwardError);
			}
		}
	},
};
