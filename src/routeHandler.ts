import { Hono } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getDashboardHtml } from './dashboard';

const app = new Hono<{ Bindings: Env; Variables: { userEmail: string } }>();

// Middleware Cloudflare Access (Tetap Sama)
app.use('/*', async (c, next) => {
	if (!c.env.TEAM_DOMAIN || !c.env.AUDIENCE_TAG) {
		c.set('userEmail', 'dev-user@localhost');
		return await next();
	}

	const token = c.req.header('cf-access-jwt-assertion');
	if (!token) return c.html('<h1>401 Unauthorized</h1>', 401);

	try {
		const jwksUrl = new URL(`${c.env.TEAM_DOMAIN}/cdn-cgi/access/certs`);
		const JWKS = createRemoteJWKSet(jwksUrl);
		const { payload } = await jwtVerify(token, JWKS, { audience: c.env.AUDIENCE_TAG });
		c.set('userEmail', payload.email as string);
		await next();
	} catch (error) {
		return c.html('<h1>403 Forbidden</h1>', 403);
	}
});

app.get('/', (c) => c.html(getDashboardHtml()));

// PERBARUAN: Endpoint dengan Paginasi dan Server-Side Search
app.get('/api/emails', async (c) => {
	const page = parseInt(c.req.query('page') || '1', 10);
	const limit = parseInt(c.req.query('limit') || '15', 10); // Default 15 email per halaman
	const search = c.req.query('search') || '';
	const offset = (page - 1) * limit;

	let condition = '';
	let params: any[] = [];

	if (search) {
		condition = 'WHERE subject LIKE ? OR sender LIKE ?';
		params = [`%${search}%`, `%${search}%`];
	}

	// Hitung total data (untuk total halaman)
	const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM emails ${condition}`)
		.bind(...params)
		.first<{ total: number }>();
	const total = countResult?.total || 0;
	const totalPages = Math.ceil(total / limit) || 1;

	// Ambil data halaman ini
	const { results } = await c.env.DB.prepare(
		`SELECT id, sender, recipient, subject, received_at FROM emails ${condition} ORDER BY received_at DESC LIMIT ? OFFSET ?`,
	)
		.bind(...params, limit, offset)
		.all();

	return c.json({
		data: results,
		meta: { total, page, limit, totalPages },
	});
});

app.get('/api/emails/:id', async (c) => {
	const id = c.req.param('id');
	const email = await c.env.DB.prepare('SELECT * FROM emails WHERE id = ?').bind(id).first();
	if (!email) return c.json({ error: 'Not found' }, 404);
	return c.json(email);
});

app.delete('/api/emails/:id', async (c) => {
	const id = c.req.param('id');
	await c.env.DB.prepare('DELETE FROM emails WHERE id = ?').bind(id).run();
	return c.json({ success: true });
});

export default app;
