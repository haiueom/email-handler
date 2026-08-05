import type { EmailRecord, EmailRow } from './types';

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

/**
 * Fetches an email by ID from D1.
 */
export async function getEmailById(db: D1Database, id: number): Promise<EmailRow | null> {
	return db.prepare('SELECT * FROM emails WHERE id = ?').bind(id).first<EmailRow>();
}

/**
 * Fetches all emails from D1, newest first.
 */
export async function listEmails(db: D1Database, limit = 50, offset = 0): Promise<EmailRow[]> {
	const result = await db.prepare('SELECT * FROM emails ORDER BY received_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all<EmailRow>();
	return result.results;
}

/**
 * Deletes an email by ID from D1. Returns true if deleted.
 */
export async function deleteEmailById(db: D1Database, id: number): Promise<boolean> {
	const result = await db.prepare('DELETE FROM emails WHERE id = ?').bind(id).run();
	return result.meta.changes > 0;
}

