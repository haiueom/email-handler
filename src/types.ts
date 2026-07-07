import type { Email } from 'postal-mime';

export interface ParsedLink {
	href: string;
	text: string;
}

export interface ExtractedContent {
	text: string;
	links: ParsedLink[];
}

export interface EmailRecord extends Omit<Email, 'html'> {
	id?: number;
	html?: string;
	raw: string;
}

export interface DbEmailRow {
	id: number;
	sender: string;
	recipient: string;
	subject: string;
	body_text: string;
	body_html: string | null;
	received_at: string;
}
