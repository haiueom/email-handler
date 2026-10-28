import { describe, it, expect } from 'vitest';
import { extractTextFromHtml, extractOtpCodes } from '../src/parser';

describe('extractTextFromHtml', () => {
	it('strips tags including attributes containing >', () => {
		const html =
			'<div class="container" style="color:red"><a href="https://example.com?x=1&y=2" title="link > here">click here</a></div>';
		expect(extractTextFromHtml(html)).toBe('click here');
	});

	it('drops script and style blocks', () => {
		const html = '<style>.x{color:red}</style><script>alert(1)</script><p>Hello</p>';
		expect(extractTextFromHtml(html)).toBe('Hello');
	});

	it('drops HTML comments', () => {
		const html = '<!-- comment with attr x="y" --><p>Hello</p>';
		expect(extractTextFromHtml(html)).toBe('Hello');
	});

	it('decodes entities', () => {
		const html = '<p>&lt;tag&gt; &amp; &quot;quoted&quot; &#39;apostrophe&#39; &nbsp;space</p>';
		expect(extractTextFromHtml(html)).toBe('<tag> & "quoted" \'apostrophe\' space');
	});
});

describe('extractOtpCodes', () => {
	it('extracts code with verification keyword', () => {
		expect(extractOtpCodes('Your verification code is 123456.')).toEqual(['123456']);
	});

	it('extracts code with otp keyword', () => {
		expect(extractOtpCodes('OTP: 987654')).toEqual(['987654']);
	});

	it('excludes phone numbers with country code', () => {
		expect(extractOtpCodes('Call +1 234-567-8901 for help.')).toEqual([]);
	});

	it('excludes codes in phone context', () => {
		expect(extractOtpCodes('mobile: 123456')).toEqual([]);
	});

	it('excludes codes embedded in larger numbers', () => {
		expect(extractOtpCodes('Your code is 1234567890')).toEqual([]);
	});

	it('works on html-extracted text', () => {
		const text = extractTextFromHtml('<p>Your verification code is <b>654321</b>.</p>');
		expect(extractOtpCodes(text)).toEqual(['654321']);
	});
});
