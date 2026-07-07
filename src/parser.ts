import * as cheerio from 'cheerio';
import type { Address } from 'postal-mime';
import type { EmailRecord, ExtractedContent, ParsedLink } from './types';

/**
 * Strips noise from an HTML email body, returns plain text and HTTP links.
 */
export function extractFromHtml(html: string): ExtractedContent {
	const $ = cheerio.load(html);
	$('style, script, head, title, meta, link, img, footer').remove();

	const text = $('body').text().replace(/\s\s+/g, ' ').trim();
	const links = $('a')
		.map((_, el): ParsedLink | null => {
			const href = $(el).attr('href');
			if (!href?.startsWith('http')) return null;
			return { href, text: ($(el).text().trim() || 'Link').substring(0, 50) };
		})
		.get()
		.filter((l): l is ParsedLink => l !== null);

	return { text, links };
}

export function formatAddress(address?: Address): string {
	if (!address) return 'Unknown';
	if (address.group) {
		return `${address.name}: ${address.group.map(formatAddress).join(', ')}`;
	}
	return address.name ? `${address.name} <${address.address}>` : (address.address ?? 'Unknown');
}

export function formatAddressList(addresses?: Address[]): string {
	if (!addresses?.length) return '-';
	return addresses.map(formatAddress).join(', ');
}

/**
 * Builds the plain-text summary file attached to the Discord message.
 */
export function buildEmailSummary(email: Omit<EmailRecord, 'id'>, extracted: ExtractedContent, storedId: number): string {
	const body = email.text || extracted.text || '(No body text)';

	const links =
		extracted.links.length > 0
			? extracted.links.map((l, i) => `${i + 1}. ${l.text}: ${l.href}`).join('\n')
			: '-';

	const attachments =
		email.attachments.length > 0
			? email.attachments.map((a, i) => `${i + 1}. ${a.filename ?? '(no filename)'} (${a.mimeType}, ${a.disposition ?? 'unknown'})`).join('\n')
			: '-';

	const section = (title: string, bar: string, content: string) => `${title}\n${bar}\n${content}`;

	return [
		section('EMAIL SUMMARY', '=============', [
			`Stored ID: ${storedId}`,
			`Subject:   ${email.subject || '(No Subject)'}`,
			`From:      ${formatAddress(email.from)}`,
			`Sender:    ${formatAddress(email.sender)}`,
			`Reply-To:  ${formatAddressList(email.replyTo)}`,
			`To:        ${formatAddressList(email.to)}`,
			`Cc:        ${formatAddressList(email.cc)}`,
			`Date:      ${email.date ?? '-'}`,
			`Message-ID:  ${email.messageId ?? '-'}`,
			`In-Reply-To: ${email.inReplyTo ?? '-'}`,
			`References:  ${email.references ?? '-'}`,
		].join('\n')),
		section('LINKS', '=====', links),
		section('ATTACHMENTS', '===========', attachments),
		section('BODY', '====', body),
	].join('\n\n');
}
