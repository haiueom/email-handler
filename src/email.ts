import PostalMime from 'postal-mime';
import { isSenderBlocked } from './filter';
import { extractTextFromHtml, buildEmailSummary } from './parser';
import { saveEmail } from './db';
import { sendDiscordNotification } from './discord';
import type { EmailRecord } from './types';

export async function handleEmail(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
	try {
		const rawBuffer = await new Response(message.raw).arrayBuffer();
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

		if (env.DISCORD_WEBHOOK_URL) {
			ctx.waitUntil(sendDiscordNotification(env.DISCORD_WEBHOOK_URL, parsedEmail, summary, storedId));
		}
	} catch (error) {
		console.error('Email handler error:', error);
		if (env.FALLBACK_EMAIL) {
			await message.forward(env.FALLBACK_EMAIL);
		} else {
			console.error('FALLBACK_EMAIL is not configured.');
		}
	}
}
