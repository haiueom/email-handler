type ParsedEmail = Awaited<ReturnType<import('postal-mime').default['parse']>>;
import { extractOtpCodes } from './parser';

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

	const bodyText = parsedEmail.text || (parsedEmail.html ? summaryText.match(/BODY\n====\n([\s\S]*)/)?.[1] || '' : '');
	const otpCodes = extractOtpCodes(bodyText);
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
	form.append('files[0]', new Blob([summaryText], { type: 'text/plain; charset=utf-8' }), `email-${storedId}.txt`);

	const res = await fetch(webhookUrl, { method: 'POST', body: form });
	if (!res.ok) {
		const body = await res.text().catch(() => '(no body)');
		throw new Error(`Discord webhook failed: ${res.status} ${res.statusText} — ${body}`);
	}
}
