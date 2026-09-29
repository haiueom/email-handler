import type { Address } from 'postal-mime';
import type { EmailRecord } from './types';

/**
 * Strips HTML tags and decodes common entities, returns plain text.
 */
export function extractTextFromHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/\s\s+/g, ' ')
		.trim();
}

/**
 * Extracts OTP codes from email text.
 * Matches 4-8 digit codes with OTP context keywords, avoiding phone numbers and addresses.
 */
export function extractOtpCodes(text: string): string[] {
	if (!text) return [];

	// OTP context keywords that should appear near the code
	const otpPatterns = [
		/(?:verification|verify|confirm|one[- ]?time|otp|code|pin|passcode|security code|access code)[\s:\-]*\b(\d{4,8})\b/gi,
		/\b(\d{4,8})\b[\s:\-]*(?:is your|is the|verification|verify|confirm|otp|code|pin)/gi,
		/(?:enter|use|input|type)[\s]+(?:code|pin|otp)[\s:]*\b(\d{4,8})\b/gi,
	];

	const codes = new Set<string>();

	for (const pattern of otpPatterns) {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(text)) !== null) {
			const code = match[1];
			// Exclude patterns that look like phone numbers (with country code prefix)
			const beforeIndex = Math.max(0, match.index - 10);
			const before = text.slice(beforeIndex, match.index);
			// Skip if preceded by + (country code) or looks like phone context
			if (/\+\d{1,3}[\s-]*$/.test(before)) continue;
			if (/phone|mobile|cell|call|fax/i.test(before)) continue;
			// Skip if code is surrounded by other digits (part of larger number)
			const afterIndex = match.index + match[0].length;
			const after = text.slice(afterIndex, afterIndex + 5);
			if (/^\d/.test(after) && !/^\d{1,2}\s/.test(after)) continue;
			codes.add(code);
		}
	}

	return [...codes];
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
export function buildEmailSummary(email: Omit<EmailRecord, 'id'>, extractedText: string, storedId: number): string {
	const body = email.text || extractedText || '(No body text)';

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
			`To:        ${formatAddressList(email.to)}`,
			`Date:      ${email.date ?? '-'}`,
		].join('\n')),
		section('ATTACHMENTS', '===========', attachments),
		section('BODY', '====', body),
	].join('\n\n');
}
