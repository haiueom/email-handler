import type { Email } from 'postal-mime';

/**
 * Represents a parsed link from the email body.
 */
export interface ParsedLink {
    href?: string;
    text: string;
}

/**
 * Represents content extracted from an email's HTML body.
 */
export interface ExtractedContent {
    text: string;
    links: ParsedLink[];
}

/**
 * Represents the structured data of a parsed email record.
 */
export interface EmailRecord extends Omit<Email, 'html'> {
    id?: number;
    html?: string;
    raw: string;
}
