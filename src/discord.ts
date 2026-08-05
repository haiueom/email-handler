type ParsedEmail = Awaited<ReturnType<import('postal-mime').default['parse']>>;

/**
 * Sends an email summary to a Discord webhook as an embed + .txt file attachment.
 */
export async function sendDiscordNotification(
	webhookUrl: string,
	parsedEmail: ParsedEmail,
	summaryText: string,
	storedId: number,
): Promise<void> {
	const fromAddress = parsedEmail.from?.address ?? 'Unknown';
	const fromName = parsedEmail.from?.name || fromAddress;
	const toAddress = parsedEmail.to?.[0]?.address ?? 'Unknown';
	const toName = parsedEmail.to?.[0]?.name || toAddress;

	const fields: Record<string, unknown>[] = [
		{ name: `📤 From: ${fromName}`, value: `\`\`\`${fromAddress}\`\`\``, inline: false },
		{ name: `📥 To: ${toName}`, value: `\`\`\`${toAddress}\`\`\``, inline: false },
	];

	// Extract OTP codes from email text
	const textContent = parsedEmail.text || '';
	const otpCodes = extractOtpCodes(textContent);
	if (otpCodes.length > 0) {
		const otpValue = otpCodes.map((code) => `\`${code}\``).join('  ');
		fields.push({ name: '🔐 OTP Code', value: otpValue, inline: false });
	}

	const embed: Record<string, unknown> = {
		title: (parsedEmail.subject || '(No Subject)').substring(0, 256),
		color: 0x3b82f6,
		fields,
		footer: { text: `ID: #${storedId} • ${new Date().toUTCString()}` },
	};

	const form = new FormData();
	form.append('payload_json', JSON.stringify({ embeds: [embed] }));
	form.append('files[0]', new Blob([summaryText], { type: 'text/plain; charset=utf-8' }), 'email.txt');

	const res = await fetch(webhookUrl, { method: 'POST', body: form });
	if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}`);
}

/**
 * Extracts OTP codes from email text.
 * Matches 4-8 digit codes with OTP context keywords, avoiding phone numbers and addresses.
 */
function extractOtpCodes(text: string): string[] {
	if (!text) return [];

	// OTP context patterns
	const patterns = [
		/(?:verification|verify|confirm|one[- ]?time|otp|code|pin|passcode|security code|access code)[\s:\-]*\b(\d{4,8})\b/gi,
		/\b(\d{4,8})\b[\s:\-]*(?:is your|is the|verification|verify|confirm|otp|code|pin)/gi,
		/(?:enter|use|input|type)[\s]+(?:code|pin|otp)[\s:]*\b(\d{4,8})\b/gi,
	];

	const codes = new Set<string>();

	for (const pattern of patterns) {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(text)) !== null) {
			const code = match[1];
			// Check context before to avoid phone numbers
			const beforeIndex = Math.max(0, match.index - 10);
			const before = text.slice(beforeIndex, match.index);
			if (/\+\d{1,3}[\s-]*$/.test(before)) continue;
			if (/phone|mobile|cell|call|fax/i.test(before)) continue;
			// Check after to avoid being part of larger number
			const afterIndex = match.index + match[0].length;
			const after = text.slice(afterIndex, afterIndex + 5);
			if (/^\d/.test(after) && !/^\d{1,2}\s/.test(after)) continue;
			codes.add(code);
		}
	}

	return [...codes];
}
