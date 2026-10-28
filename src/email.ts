import PostalMime from 'postal-mime';
import { isSenderBlocked } from './filter';
import { extractTextFromHtml, buildEmailSummary } from './parser';
import { saveEmail } from './db';
import { sendDiscordNotification } from './discord';
import { sendTelegramNotification } from './telegram';
import type { EmailRecord } from './types';

export async function handleEmail(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
	let rawBuffer: ArrayBuffer | undefined;
	try {
		rawBuffer = await new Response(message.raw).arrayBuffer();
		const parsedEmail = await new PostalMime().parse(rawBuffer);

		const sender = parsedEmail.from?.address?.toLowerCase();
		if (sender && isSenderBlocked(sender, env)) {
			console.warn(`Blocked sender: ${sender}`);
			message.setReject('Policy: Sender blocked by user policy.');
			return;
		}

		const bodyText = parsedEmail.text || extractTextFromHtml(parsedEmail.html ?? '');
		const emailData: Omit<EmailRecord, 'id'> = {
			...parsedEmail,
			raw: new TextDecoder().decode(rawBuffer),
		};

		const storedId = await saveEmail(env.DB, emailData, bodyText);
		const summary = buildEmailSummary(emailData, bodyText, storedId);

		const notifications: Promise<void>[] = [];

		if (env.DISCORD_WEBHOOK_URL) {
			notifications.push(sendDiscordNotification(env.DISCORD_WEBHOOK_URL, parsedEmail, summary, storedId));
		}

		if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
			notifications.push(sendTelegramNotification(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, parsedEmail, summary, storedId));
		}

		for (const notification of notifications) {
			ctx.waitUntil(notification.catch((error) => console.error('Notification failed:', error)));
		}
	} catch (error) {
		console.error('Email handler error:', error);

		// Best-effort sender extraction so blocked senders cannot bypass the blocklist
		// by sending malformed messages that fail during parsing.
		let blocked = false;
		if (rawBuffer) {
			try {
				const rawText = new TextDecoder().decode(rawBuffer);
				const match = rawText.match(/^From:[^\r\n]*<([^>\r\n]+)>/im) ?? rawText.match(/^From:\s*([^\r\n<]+)/im);
				const sender = match?.[1]?.trim().toLowerCase();
				if (sender && isSenderBlocked(sender, env)) {
					blocked = true;
					console.warn(`Blocked sender (parse failure): ${sender}`);
					message.setReject('Policy: Sender blocked by user policy.');
				}
			} catch {
				// Ignore sender extraction errors and fall through.
			}
		}

		if (blocked) return;

		if (env.FALLBACK_EMAIL) {
			try {
				await message.forward(env.FALLBACK_EMAIL);
			} catch (forwardError) {
				console.error('Failed to forward to FALLBACK_EMAIL:', forwardError);
			}
		} else {
			console.error('FALLBACK_EMAIL is not configured.');
		}
	}
}
