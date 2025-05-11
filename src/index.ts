import PostalMime from 'postal-mime';
import * as cheerio from 'cheerio';

function extractTextAndLinks(html: string) {
	const $ = cheerio.load(html);

	// Remove unwanted tags
	$('style, script').remove();

	// Get text content
	const text = $('body').text().replace(/\s+/g, ' ').trim();

	// Extract links
	const links = $('a').map((_: any, a: any) => ({
		href: $(a).attr('href'),
		text: $(a).text().trim()
	})).get();

	return { text, links };
}

async function incrementMailCount(db: KVNamespace): Promise<number> {
	const prev = (await db.get('stats-count')) || '0';
	const next = parseInt(prev) + 1;
	await db.put('stats-count', String(next));
	return next;
}

async function saveEmail(
	db: KVNamespace,
	recipient: string,
	key: string,
	data: any
): Promise<void> {
	await db.put(`${recipient}-${key}`, JSON.stringify(data));
}

async function sendDiscordAttachment(
	text: string,
	filename: string,
	webhook: string
): Promise<void> {
	const form = new FormData();
	// Attach the text as a .txt file
	form.append('file', new Blob([text], { type: 'text/plain' }), filename);

	const res = await fetch(webhook, {
		method: 'POST',
		body: form,
	});
	if (!res.ok) {
		console.error('Discord webhook failed:', await res.text());
	}
}

export default {
	async email(
		message: ForwardableEmailMessage,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		try {
			// parse raw MIME
			const parser = new PostalMime();
			const rawBuffer = await new Response(message.raw).arrayBuffer();
			const email = await parser.parse(rawBuffer);

			// increment and persist stats
			await incrementMailCount(env.MAIL_DB);

			// choose sender / recipient
			const sender = email.from.address;
			const recipient = email.to?.[0]?.address ?? 'unknown';

			// generate lookup key and save full email JSON
			const key = Math.random().toString(16).slice(2, 10);
			const record = { key, ...email };
			await saveEmail(env.MAIL_DB, recipient, key, record);

			// prepare human-readable text
			const sentDate = email.date ? new Date(email.date) : new Date();
			const humanDate = sentDate.toLocaleString();
			const cleanHtml = extractTextAndLinks(email.html || '')

			const lines = [
				`📤 From    : ${sender}`,
				`📥 To      : ${recipient}`,
				`🔐 Key     : ${key}`,
				`📅 Date    : ${humanDate}`,
				`🧾 Subject : ${email.subject || '(no subject)'}`,
				``,
				`🔗 Links   :`,
				...cleanHtml.links.map((link: any) => {
					return `- ${link.text} (${link.href})`;
				}),
				``,
				`💌 Message :`,
				`${email.text || cleanHtml.text || '(no text)'}`,
			];
			const content = lines.join('\n');

			// send as .txt attachment
			const filename = `email_${recipient}_${key}.txt`;
			await sendDiscordAttachment(content, filename, env.DC_WEBHOOK);
		} catch (err) {
			console.error('Error in email handler:', err);
		}
	},
};
