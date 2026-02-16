import PostalMime from 'postal-mime'; // Referensi: https://github.com/postalsys/emailjs-mime-parser
import * as cheerio from 'cheerio'; // Referensi: https://cheerio.js.org/
import { BLOCKED_EMAILS, BLOCK_PATTERNS } from './blocklist';
import type { EmailRecord, ExtractedContent, ParsedLink } from './types';

// Optimalisasi pencarian email yang diblokir menggunakan Set (O(1) lookup)
const BLOCKED_EMAILS_SET = new Set(BLOCKED_EMAILS.map((e) => e.toLowerCase()));

/**
 * Perbaikan Regex: Escape karakter khusus '.' agar pola *.za.com
 * tidak mencocokkan xza.com, melainkan hanya sub-domain dari za.com.
 */
const globToRegex = (pattern: string): RegExp => {
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	const wildcard = escaped.replace(/\\\*/g, '.*');
	return new RegExp(`^${wildcard}$`, 'i');
};

const COMPILED_BLOCK_PATTERNS = BLOCK_PATTERNS.map(globToRegex);

function isDomainBlocked(senderDomain: string): boolean {
	return COMPILED_BLOCK_PATTERNS.some((regex) => regex.test(senderDomain));
}

/**
 * Membersihkan elemen HTML yang tidak perlu (script, style, dll)
 * untuk mendapatkan teks murni yang bersih.
 */
function extractFromHtml(html: string): ExtractedContent {
	const $ = cheerio.load(html);
	$('style, script, head, title, meta, link, img, footer').remove();

	const text = $('body').text().replace(/\s\s+/g, ' ').trim();
	const links = $('a')
		.map(
			(_, el): ParsedLink => ({
				href: $(el).attr('href'),
				text: $(el).text().trim() || 'Link',
			}),
		)
		.get()
		.filter((l) => l.href?.startsWith('http')); // Pastikan link valid

	return { text, links };
}

/**
 * Fitur Baru: Mendeteksi kode OTP atau verifikasi (4-8 digit angka)
 * dari teks email menggunakan Regex.
 */
function extractOTP(text: string): string | null {
	const otpRegex = /\b\d{4,8}\b/g;
	const matches = text.match(otpRegex);
	// Mengambil kecocokan terakhir karena seringkali format tanggal/waktu muncul di awal
	return matches ? matches[matches.length - 1] : null;
}

/**
 * Menyimpan email ke D1 Database dan mengembalikan ID baris yang baru disisipkan.
 */
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

		// Parsing MIME email
		const parser = new PostalMime();
		const parsedEmail = await parser.parse(rawBuffer);
		const sender = parsedEmail.from?.address?.toLowerCase();

		// Validasi Blocklist
		if (sender) {
			const domain = sender.split('@')[1];
			if (BLOCKED_EMAILS_SET.has(sender) || isDomainBlocked(domain)) {
				console.warn(`Blocked sender: ${sender}`);
				message.setReject('Policy: Sender blocked by user policy.');
				return; // Hentikan proses jika diblokir
			}
		}

		// Ekstraksi konten
		const extracted = extractFromHtml(parsedEmail.html || '');
		const fullContent = parsedEmail.text || extracted.text;
		const otpCode = extractOTP(fullContent);

		const emailData: Omit<EmailRecord, 'id'> = {
			...parsedEmail,
			raw: new TextDecoder().decode(rawBuffer),
		};

		// Simpan ke DB
		const newId = await saveEmail(env.DB, emailData, extracted.text);

		// Format waktu Indonesia Tengah (WITA) karena lokasi kita di Bali
		const dateStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });

		// Notifikasi Discord
		const discordMessage = [
			`📥 **New Email Received** [#${newId}]`,
			`**From**: ${parsedEmail.from?.name || 'Unknown'} \`<${parsedEmail.from?.address}>\``,
			`**To**: \`<${parsedEmail.to?.[0]?.address}>\``,
			`**Subject**: ${parsedEmail.subject || '(No Subject)'}`,
			`**Date**: ${dateStr} WITA`,
			otpCode ? `\n🔑 **Detected OTP/Code: \`${otpCode}\`**` : '',
			`\n📝 **Preview**:\n> ${fullContent.substring(0, 200).replace(/\n/g, '\n> ')}...`,
			// Ganti bagian ini:
			env.DASHBOARD_URL ? `\n🔗 [Open Email](${env.DASHBOARD_URL}?id=${newId})` : '',
		]
			.filter(Boolean)
			.join('\n');

		const formData = new FormData();
		formData.append('content', discordMessage);

		await fetch(env.DISCORD_WEBHOOK_URL, { method: 'POST', body: formData });
	} catch (error) {
		console.error('Handler Error:', error);

		// Fallback ke email pribadi menggunakan environment variables agar lebih aman
		if (env.FALLBACK_EMAIL) {
			await message.forward(env.FALLBACK_EMAIL);
		} else {
			console.error('FALLBACK_EMAIL tidak dikonfigurasi di environment variables.');
		}
	}
}
