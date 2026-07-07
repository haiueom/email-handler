import type { Email } from 'postal-mime';
import type { ExtractedContent } from './types';

type ParsedEmail = Awaited<ReturnType<import('postal-mime').default['parse']>>;

/**
 * Sends an email summary to a Discord webhook as an embed + .txt file attachment.
 */
export async function sendDiscordNotification(
	webhookUrl: string,
	dashboardUrl: string | undefined,
	parsedEmail: ParsedEmail,
	extracted: ExtractedContent,
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

	if (extracted.links.length > 0) {
		const top = extracted.links.slice(0, 5);
		let linksText = top.map((l) => `- [${l.text}](${l.href})`).join('\n');
		if (extracted.links.length > 5) linksText += `\n*...and ${extracted.links.length - 5} more*`;
		fields.push({ name: '🔗 Links', value: linksText.substring(0, 1024), inline: false });
	}

	const embed: Record<string, unknown> = {
		title: (parsedEmail.subject || '(No Subject)').substring(0, 256),
		color: 0x3b82f6,
		fields,
		footer: { text: `ID: #${storedId} • ${new Date().toUTCString()}` },
	};

	if (dashboardUrl) embed.url = `${dashboardUrl}?id=${storedId}`;

	const form = new FormData();
	form.append('payload_json', JSON.stringify({ embeds: [embed] }));
	form.append('files[0]', new Blob([summaryText], { type: 'text/plain; charset=utf-8' }), 'email.txt');

	const res = await fetch(webhookUrl, { method: 'POST', body: form });
	if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}`);
}
