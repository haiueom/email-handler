/**
 * Exact sender addresses to block (lowercase).
 * Configure via BLOCKED_EMAILS env var (comma-separated).
 */
export function getBlockedEmails(env?: Env): string[] {
	if (!env?.BLOCKED_EMAILS) return [];
	return env.BLOCKED_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Domain glob patterns to block. '*' matches any characters.
 * Configure via BLOCK_PATTERNS env var (comma-separated).
 *
 * Examples:
 *   'spam.com'   — blocks spam.com exactly
 *   '*.spam.com' — blocks all subdomains of spam.com
 */
export function getBlockPatterns(env?: Env): string[] {
	if (!env?.BLOCK_PATTERNS) return [];
	return env.BLOCK_PATTERNS.split(',').map((p) => p.trim()).filter(Boolean);
}

/**
 * Returns true if the lowercase sender address or its domain is blocked.
 */
export function isSenderBlocked(sender: string, env?: Env): boolean {
	const blockedSet = new Set(getBlockedEmails(env));
	if (blockedSet.has(sender)) return true;

	const at = sender.lastIndexOf('@');
	if (at <= 0 || at === sender.length - 1) return false;

	const domain = sender.slice(at + 1);
	const patterns = getBlockPatterns(env).map((pattern) => {
		const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`, 'i');
	});

	return patterns.some((re) => re.test(domain));
}
