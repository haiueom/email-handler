/**
 * A list of specific, lowercase email addresses to block.
 * This list is for exact matches only.
 */
export const BLOCKED_EMAILS: string[] = [
    'specific-spammer@gmail.com',
    'another-spammer@yahoo.com',
];

/**
 * A list of domain patterns to block.
 * The '*' character acts as a wildcard for any characters.
 *
 * EXAMPLES:
 * 'spam.com'      -> Blocks emails from 'spam.com' exactly.
 * '*.spam.net'    -> Blocks emails from all subdomains of 'spam.net' (e.g., 'offers.spam.net').
 * To block a domain AND all its subdomains, add both entries: 'za.com' and '*.za.com'.
 */
export const BLOCK_PATTERNS: string[] = [
    // Blocks the exact domain za.com AND any subdomain of za.com
    'za.com',
    '*.za.com',

    // Blocks the exact domain sa.com AND any subdomain of sa.com
    'sa.com',
    '*.sa.com',
];
