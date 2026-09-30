type ParsedEmail = Awaited<ReturnType<import('postal-mime').default['parse']>>;
import { extractOtpCodes } from './parser';

/**
 * Sends an email summary to a Telegram chat via bot API.
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.
 */
export async function sendTelegramNotification(
	botToken: string,
	chatId: string,
	parsedEmail: ParsedEmail,
	summaryText: string,
	storedId: number,
): Promise<void> {
	const fromAddress = parsedEmail.from?.address ?? 'Unknown';
	const toAddress = parsedEmail.to?.[0]?.address ?? 'Unknown';
	const subject = parsedEmail.subject || '(No Subject)';

	const bodyText = parsedEmail.text || (parsedEmail.html ? summaryText.match(/BODY\n====\n([\s\S]*)/)?.[1] || '' : '');
	const otpCodes = extractOtpCodes(bodyText);

	// ponytail: parse_mode=HTML needs entity-encoded values; upgrade path: none
	const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	const lines = [
		`<b>${esc(subject)}</b>`,
		'',
		`📤 From: <code>${esc(fromAddress)}</code>`,
		`📥 To: <code>${esc(toAddress)}</code>`,
	];
	if (otpCodes.length > 0) {
		lines.push(`🔐 OTP: <code>${esc(otpCodes.join('  '))}</code>`);
	}
	lines.push(`🆔 ID: #${storedId}`);

	const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId,
			text: lines.join('\n'),
			parse_mode: 'HTML',
			link_preview_options: { is_disabled: true },
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '(no body)');
		throw new Error(`Telegram notification failed: ${res.status} ${res.statusText} — ${body}`);
	}
}
