import { Hono } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getDashboardHtml } from './dashboard';

// Tambahkan Variables ke generic Hono untuk menyimpan data user yang login
const app = new Hono<{ Bindings: Env; Variables: { userEmail: string } }>();

// Middleware Cloudflare Access Zero Trust
app.use('/*', async (c, next) => {
	// Bypass aman untuk Local Development (jika Env belum diisi di .dev.vars)
	if (!c.env.TEAM_DOMAIN || !c.env.AUDIENCE_TAG) {
		console.warn('⚠️ TEAM_DOMAIN atau AUDIENCE_TAG tidak diset. Bypass autentikasi aktif (Hanya untuk Dev).');
		c.set('userEmail', 'dev-user@localhost');
		return await next();
	}

	const token = c.req.header('cf-access-jwt-assertion');
	if (!token) {
		return c.html('<h1>401 Unauthorized</h1><p>Missing Cloudflare Access token.</p>', 401);
	}

	try {
		// Mengambil Public Keys (JWKS) langsung dari Cloudflare
		const jwksUrl = new URL(`${c.env.TEAM_DOMAIN}/cdn-cgi/access/certs`);
		const JWKS = createRemoteJWKSet(jwksUrl);

		// Verifikasi Signature dan Audience
		const { payload } = await jwtVerify(token, JWKS, {
			audience: c.env.AUDIENCE_TAG,
		});

		// Simpan identitas pengguna (opsional, berguna jika ingin mencatat log siapa yang mengakses)
		c.set('userEmail', payload.email as string);

		await next();
	} catch (error) {
		console.error('JWT Verification Failed:', error);
		return c.html('<h1>403 Forbidden</h1><p>Invalid or expired Access token.</p>', 403);
	}
});

app.get('/', (c) => {
	return c.html(getDashboardHtml());
});

app.get('/api/emails', async (c) => {
	const { results } = await c.env.DB.prepare(
		'SELECT id, sender, recipient, subject, received_at FROM emails ORDER BY received_at DESC LIMIT 50',
	).all();
	return c.json(results);
});

app.get('/api/emails/:id', async (c) => {
	const id = c.req.param('id');
	const email = await c.env.DB.prepare('SELECT * FROM emails WHERE id = ?').bind(id).first();

	if (!email) return c.json({ error: 'Email tidak ditemukan' }, 404);
	return c.json(email);
});

app.delete('/api/emails/:id', async (c) => {
	const id = c.req.param('id');
	await c.env.DB.prepare('DELETE FROM emails WHERE id = ?').bind(id).run();
	return c.json({ success: true });
});

export default app;
