import PostalMime from 'postal-mime';
import * as cheerio from 'cheerio';
import { BLOCKED_EMAILS, BLOCK_PATTERNS } from './blocklist';
import type { EmailRecord, ExtractedContent, ParsedLink } from './types';

const BLOCKED_EMAILS_SET = new Set(BLOCKED_EMAILS.map((e) => e.toLowerCase()));

const globToRegex = (pattern: string): RegExp => {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
	const wildcard = escaped.replace(/\*/g, '.*');
	return new RegExp(`^${wildcard}$`, 'i');
};

const COMPILED_BLOCK_PATTERNS = BLOCK_PATTERNS.map(globToRegex);

function isDomainBlocked(senderDomain: string): boolean {
	return COMPILED_BLOCK_PATTERNS.some((regex) => regex.test(senderDomain));
}

function extractFromHtml(html: string): ExtractedContent {
	const $ = cheerio.load(html);
	$('style, script, head, title, meta, link, img, footer').remove();

	const text = $('body').text().replace(/\s\s+/g, ' ').trim();
	const links = $('a')
		.map(
			(_, el): ParsedLink => ({
				href: $(el).attr('href'),
				// Batasi panjang teks link agar tidak merusak layout Discord
				text: ($(el).text().trim() || 'Link').substring(0, 50),
			}),
		)
		.get()
		.filter((l) => l.href?.startsWith('http'));

	return { text, links };
}

function extractOTP(text: string): string | null {
	const otpRegex = /\b\d{4,8}\b/g;
	const matches = text.match(otpRegex);
	return matches ? matches[matches.length - 1] : null;
}

async function saveEmail(db: D1Database, email: Omit<EmailRecord, 'id'>, extractedText: string): Promise<number> {
	const result = await db
		.prepare(
			`INSERT INTO emails (recipient, sender, subject, body_text, body_html, raw_email)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			email.to?.[0]?.address ?? 'unknown',
			email.from?.address ?? 'unknown',
			email.subject || '(No Subject)',
			email.text || extractedText || '',
			email.html || '',
			email.raw,
		)
		.run();

	if (!result.success || result.meta.last_row_id === null) {
		throw new Error('D1: Gagal menyimpan email ke database');
	}
	return result.meta.last_row_id;
}

export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
	try {
		const rawBuffer = await new Response(message.raw).arrayBuffer();

		const parser = new PostalMime();
		const parsedEmail = await parser.parse(rawBuffer);
		const sender = parsedEmail.from?.address?.toLowerCase();

		if (sender) {
			const domain = sender.split('@')[1];
			if (BLOCKED_EMAILS_SET.has(sender) || isDomainBlocked(domain)) {
				console.warn(`Blocked sender: ${sender}`);
				message.setReject('Policy: Sender blocked by user policy.');
				return;
			}
		}

		const extracted = extractFromHtml(parsedEmail.html || '');
		const fullContent = parsedEmail.text || extracted.text;
		const otpCode = extractOTP(fullContent);

		const emailData: Omit<EmailRecord, 'id'> = {
			...parsedEmail,
			raw: new TextDecoder().decode(rawBuffer),
		};

		const newId = await saveEmail(env.DB, emailData, extracted.text);
		const dateStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });

		// Menyusun format Link untuk Discord (maksimal 5 link agar Embed tidak terlalu panjang)
		let linksText = '';
		if (extracted.links && extracted.links.length > 0) {
			const topLinks = extracted.links.slice(0, 5);
			linksText = topLinks.map((l) => `- [${l.text}](${l.href})`).join('\n');
			if (extracted.links.length > 5) {
				linksText += `\n*...dan ${extracted.links.length - 5} tautan lainnya*`;
			}
		}

		// Menyusun Embed Discord
		const embed: any = {
			title: (parsedEmail.subject || '(No Subject)').substring(0, 256), // Max 256 karakter
			color: 0x3b82f6, // Warna biru Tailwind (blue-500)
			fields: [
				{
					name: `📤 From ${parsedEmail.from?.name || 'Unknown'} \`(${parsedEmail.from?.address})\``,
					value: `\`\`\`${parsedEmail.from?.address}\`\`\``,
					inline: false,
				},
				{
					name: `📥 To ${parsedEmail.to?.[0].name || 'Unknown'} \`(${parsedEmail.to?.[0]?.address})\``,
					value: `\`\`\`${parsedEmail.to?.[0]?.address}\`\`\``,
					inline: false,
				},
			],
			footer: {
				text: `ID: #${newId} • ${dateStr} WITA`,
			},
		};

		if (env.DASHBOARD_URL) {
			embed.url = `${env.DASHBOARD_URL}?id=${newId}`; // Judul embed akan menjadi link yang bisa diklik
		}

		if (otpCode) {
			embed.description = `**🔑 Detected OTP/Code:** \`\`\`${otpCode}\`\`\``;
		}

		if (linksText) {
			embed.fields.push({
				name: '🔗 Links',
				value: linksText.substring(0, 1024), // Limit field value Discord (1024 karakter)
				inline: false,
			});
		}

		// Mengirim JSON ke Discord Webhook
		await fetch(env.DISCORD_WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ embeds: [embed] }),
		});
	} catch (error) {
		console.error('Handler Error:', error);

		if (env.FALLBACK_EMAIL) {
			await message.forward(env.FALLBACK_EMAIL);
		} else {
			console.error('FALLBACK_EMAIL tidak dikonfigurasi di environment variables.');
		}
	}
}
