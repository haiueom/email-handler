import PostalMime from 'postal-mime';

async function notifyDiscord(message: string | { embeds: any[] }, webhook: string): Promise<void> {
	const response = await fetch(webhook, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(message),
	});
	if (!response.ok) {
		console.error('Failed to send Discord notification');
	}
}

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const parser = new PostalMime();
		const body = await new Response(message.raw).arrayBuffer();
		const email = await parser.parse(body);

		let prev_count = (await env.MAIL_DB.get('stats-count')) || '0';
		await env.MAIL_DB.put('stats-count', String(parseInt(prev_count) + 1));

		let sender = email.from.address;
		let recipient = email.to?.[0]?.address || 'Unknown';
		const key = Math.random().toString(16).slice(2, 10);

		const data = {
			key: key,
			...email,
		};

		await env.MAIL_DB.put(recipient + '-' + key, JSON.stringify(data));

		const date = email.date ? new Date(email.date) : new Date();
		const discordTimestamp = `<t:${Math.floor(date.getTime() / 1000)}:F>`;
		const dcMessage = (email.text || '').length > 1000 ? (email.text || '').slice(0, 1000) + '...' : email.text;

		const embedMessage = {
			embeds: [
				{
					title: `📧 New Email Received`,
					color: 2354155,
					fields: [
						{ name: '📤 From', value: `\`\`\`${sender}\`\`\``, inline: true },
						{ name: '📥 To', value: `\`\`\`${recipient}\`\`\``, inline: true },
						{ name: '\t', value: '\t', inline: false },
						{ name: '🔐 Key', value: `\`\`\`${key}\`\`\``, inline: true },
						{
							name: '📅 Date',
							value: `\`\`\`${discordTimestamp}\`\`\``,
							inline: true,
						},
						{ name: '\t', value: '\t', inline: false },
						{ name: '🧾 Subject', value: email.subject, inline: false },
						{ name: '💌 Message', value: dcMessage, inline: false },
					],
					footer: {
						text: 'email-handler',
					},
					timestamp: new Date().toISOString(),
				},
			],
		};

		await notifyDiscord(embedMessage, env.DC_WEBHOOK);
	},
};
