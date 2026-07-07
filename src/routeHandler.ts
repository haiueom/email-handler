import { Hono } from 'hono';
import type { Context } from 'hono';
import * as cheerio from 'cheerio';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getDashboardHtml } from './dashboard';
import type { DbEmailRow } from './types';

type AppBindings = { Bindings: Env; Variables: { userEmail: string } };

const app = new Hono<AppBindings>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parsePositiveInt = (value: string | undefined, fallback: number, max?: number): number => {
	if (!value || !/^\d+$/.test(value)) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
	return max !== undefined ? Math.min(parsed, max) : parsed;
};

const parseIdParam = (value: string): number | undefined => {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 1 || String(parsed) !== value) return undefined;
	return parsed;
};

const DANGEROUS_ATTRS = new Set(['style', 'src', 'srcset', 'background', 'poster', 'action', 'formaction']);

function sanitizeHtml(html: string | null | undefined): string {
	if (!html) return '';
	const $ = cheerio.load(html);
	$('script, style, link, meta, iframe, object, embed, img, picture, source, video, audio').remove();
	$('*').each((_, el) => {
		for (const name of Object.keys($(el).attr() ?? {})) {
			const norm = name.toLowerCase();
			if (norm.startsWith('on') || DANGEROUS_ATTRS.has(norm)) {
				$(el).removeAttr(name);
			}
		}
		const href = $(el).attr('href');
		if (href && !/^(https?:|mailto:)/i.test(href)) $(el).removeAttr('href');
	});
	return $.html();
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function isBasicAuthValid(authorization: string | undefined, username: string, password: string): boolean {
	if (!authorization?.startsWith('Basic ')) return false;
	try {
		const decoded = atob(authorization.slice(6));
		const sep = decoded.indexOf(':');
		if (sep < 0) return false;
		return decoded.slice(0, sep) === username && decoded.slice(sep + 1) === password;
	} catch {
		return false;
	}
}

const unauthorized = (c: Context<AppBindings>) =>
	c.html('<h1>401 Unauthorized</h1>', 401, {
		'WWW-Authenticate': 'Basic realm="Email Dashboard", charset="UTF-8"',
	});

app.use('/*', async (c, next) => {
	// Cloudflare Access (JWT) — takes priority
	if (c.env.TEAM_DOMAIN && c.env.AUDIENCE_TAG) {
		const token = c.req.header('cf-access-jwt-assertion');
		if (!token) return c.html('<h1>401 Unauthorized</h1>', 401);
		try {
			const JWKS = createRemoteJWKSet(new URL(`${c.env.TEAM_DOMAIN}/cdn-cgi/access/certs`));
			const { payload } = await jwtVerify(token, JWKS, { audience: c.env.AUDIENCE_TAG });
			c.set('userEmail', payload.email as string);
			return await next();
		} catch {
			return c.html('<h1>403 Forbidden</h1>', 403);
		}
	}

	// HTTP Basic Auth fallback
	if (c.env.DASHBOARD_USER && c.env.DASHBOARD_PASS) {
		if (!isBasicAuthValid(c.req.header('Authorization'), c.env.DASHBOARD_USER, c.env.DASHBOARD_PASS)) {
			return unauthorized(c);
		}
		c.set('userEmail', c.env.DASHBOARD_USER);
		return await next();
	}

	return c.html('<h1>Dashboard authentication is not configured</h1>', 503);
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/', (c) => c.html(getDashboardHtml()));

app.get('/api/emails', async (c) => {
	try {
		const page = parsePositiveInt(c.req.query('page'), 1);
		const limit = parsePositiveInt(c.req.query('limit'), 15, 100);
		const search = c.req.query('search')?.trim() ?? '';
		const offset = (page - 1) * limit;

		const condition = search ? 'WHERE subject LIKE ? OR sender LIKE ?' : '';
		const searchParams: unknown[] = search ? [`%${search}%`, `%${search}%`] : [];

		const [countResult, listResult] = await c.env.DB.batch([
			c.env.DB.prepare(`SELECT COUNT(*) as total FROM emails ${condition}`).bind(...searchParams),
			c.env.DB.prepare(
				`SELECT id, sender, recipient, subject, received_at FROM emails ${condition} ORDER BY received_at DESC LIMIT ? OFFSET ?`,
			).bind(...searchParams, limit, offset),
		]);

		const total = (countResult.results[0] as { total: number } | undefined)?.total ?? 0;
		const totalPages = Math.max(1, Math.ceil(total / limit));

		return c.json({ data: listResult.results, meta: { total, page, limit, totalPages } });
	} catch (err) {
		console.error('GET /api/emails error:', err);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

app.get('/api/emails/:id', async (c) => {
	const id = parseIdParam(c.req.param('id'));
	if (!id) return c.json({ error: 'Invalid id' }, 400);

	try {
		const row = await c.env.DB.prepare(
			'SELECT id, recipient, sender, subject, body_text, body_html, received_at FROM emails WHERE id = ?',
		)
			.bind(id)
			.first<DbEmailRow>();

		if (!row) return c.json({ error: 'Not found' }, 404);
		return c.json({ ...row, body_html: sanitizeHtml(row.body_html) });
	} catch (err) {
		console.error(`GET /api/emails/${id} error:`, err);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

app.delete('/api/emails/:id', async (c) => {
	const id = parseIdParam(c.req.param('id'));
	if (!id) return c.json({ error: 'Invalid id' }, 400);

	try {
		const result = await c.env.DB.prepare('DELETE FROM emails WHERE id = ?').bind(id).run();
		if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
		return c.json({ success: true });
	} catch (err) {
		console.error(`DELETE /api/emails/${id} error:`, err);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

export default app;
