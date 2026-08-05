import type { Email } from 'postal-mime';

export interface EmailRecord extends Omit<Email, 'html'> {
	id?: number;
	html?: string;
	raw: string;
}

/** Row shape returned from D1 queries on the emails table */
export interface EmailRow {
	id: number;
	recipient: string | null;
	sender: string | null;
	subject: string | null;
	body_text: string | null;
	body_html: string | null;
	raw_email: string | null;
	received_at: string | null;
}
