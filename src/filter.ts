/**
 * Exact sender addresses to block (lowercase).
 */
export const BLOCKED_EMAILS: string[] = ['specific-spammer@gmail.com', 'another-spammer@yahoo.com'];

/**
 * Domain glob patterns to block. '*' matches any characters.
 *
 * Examples:
 *   'spam.com'   — blocks spam.com exactly
 *   '*.spam.com' — blocks all subdomains of spam.com
 */
export const BLOCK_PATTERNS: string[] = ['za.com', '*.za.com', 'sa.com', '*.sa.com'];

// --- compiled at module load, paid once per worker instance ---

const BLOCKED_SET = new Set(BLOCKED_EMAILS.map((e) => e.toLowerCase()));

const COMPILED_PATTERNS = BLOCK_PATTERNS.map((pattern) => {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`, 'i');
});

/**
 * Returns true if the lowercase sender address or its domain is blocked.
 */
export function isSenderBlocked(sender: string): boolean {
	if (BLOCKED_SET.has(sender)) return true;
	const at = sender.lastIndexOf('@');
	if (at <= 0 || at === sender.length - 1) return false;
	const domain = sender.slice(at + 1);
	return COMPILED_PATTERNS.some((re) => re.test(domain));
}
