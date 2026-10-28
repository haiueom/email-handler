import { describe, it, expect } from 'vitest';
import { isSenderBlocked } from '../src/filter';

describe('isSenderBlocked', () => {
	it('blocks exact address', () => {
		const env = { BLOCKED_EMAILS: 'spam@example.com' } as Env;
		expect(isSenderBlocked('spam@example.com', env)).toBe(true);
		expect(isSenderBlocked('other@example.com', env)).toBe(false);
	});

	it('is case-insensitive', () => {
		const env = { BLOCKED_EMAILS: 'Spam@Example.com' } as Env;
		expect(isSenderBlocked('spam@example.com', env)).toBe(true);
	});

	it('blocks exact domain pattern', () => {
		const env = { BLOCK_PATTERNS: 'spam.com' } as Env;
		expect(isSenderBlocked('user@spam.com', env)).toBe(true);
		expect(isSenderBlocked('user@notspam.com', env)).toBe(false);
	});

	it('blocks wildcard subdomain pattern', () => {
		const env = { BLOCK_PATTERNS: '*.spam.com' } as Env;
		expect(isSenderBlocked('user@mail.spam.com', env)).toBe(true);
		expect(isSenderBlocked('user@spam.com', env)).toBe(false);
	});

	it('handles missing env', () => {
		expect(isSenderBlocked('user@example.com')).toBe(false);
	});

	it('handles invalid sender (no @)', () => {
		const env = { BLOCK_PATTERNS: 'spam.com' } as Env;
		expect(isSenderBlocked('not-an-email', env)).toBe(false);
	});
});