import PostalMime from 'postal-mime';
import { isSenderBlocked } from './blocklist';
import { extractFromHtml, buildEmailSummary } from './parser';
import { saveEmail } from './db';
import { sendDiscordNotification } from './discord';
import type { EmailRecord } from './types';

export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
	try {
		const rawBytes = await new Response(message.raw).bytes();
		const parsedEmail = await new PostalMime().parse(rawBytes);

		const sender = parsedEmail.from?.address?.toLowerCase();
		if (sender && isSenderBlocked(sender)) {
			console.warn(`Blocked sender: ${sender}`);
			message.setReject('Policy: Sender blocked by user policy.');
			return;
		}

		const extracted = extractFromHtml(parsedEmail.html ?? '');
		const emailData: Omit<EmailRecord, 'id'> = {
			...parsedEmail,
			raw: new TextDecoder().decode(rawBytes),
		};

		const storedId = await saveEmail(env.DB, emailData, extracted.text);
		const summary = buildEmailSummary(emailData, extracted, storedId);

		await sendDiscordNotification(env.DISCORD_WEBHOOK_URL, env.DASHBOARD_URL, parsedEmail, extracted, summary, storedId);
	} catch (error) {
		console.error('Email handler error:', error);
		if (env.FALLBACK_EMAIL) {
			await message.forward(env.FALLBACK_EMAIL);
		} else {
			console.error('FALLBACK_EMAIL is not configured.');
		}
	}
}
