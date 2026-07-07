import type { EmailRecord } from './types';

/**
 * Inserts a parsed email into D1 and returns the new row ID.
 */
export async function saveEmail(db: D1Database, email: Omit<EmailRecord, 'id'>, extractedText: string): Promise<number> {
	const result = await db
		.prepare(
			`INSERT INTO emails (recipient, sender, subject, body_text, body_html, raw_email)
			VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			email.to?.[0]?.address ?? 'unknown',
			email.from?.address ?? 'unknown',
			email.subject || '(No Subject)',
			email.text || extractedText || '',
			email.html || '',
			email.raw,
		)
		.run();

	if (!result.success || result.meta.last_row_id == null) {
		throw new Error('D1: Failed to save email to database');
	}
	return result.meta.last_row_id;
}
