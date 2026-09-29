import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { EmailRow } from '../types'

const app = new Hono<{ Bindings: Env }>()

function parseEmailId(id: string): number | null {
	const parsed = Number(id);
	return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

const listQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().optional(),
})

app.get('/', zValidator('query', listQuerySchema), async (c) => {
	const { page, limit, search } = c.req.valid('query')
	const offset = (page - 1) * limit
	const condition = search ? 'WHERE subject LIKE ? OR sender LIKE ?' : ''
	const searchParams: unknown[] = search ? [`%${search}%`, `%${search}%`] : []

	const [countResult, listResult] = await c.env.DB.batch([
		c.env.DB.prepare(`SELECT COUNT(*) as total FROM emails ${condition}`).bind(...searchParams),
		c.env.DB.prepare(`SELECT id, sender, recipient, subject, received_at FROM emails ${condition} ORDER BY received_at DESC LIMIT ? OFFSET ?`).bind(...searchParams, limit, offset),
	])

	const total = (countResult.results[0] as { total: number } | undefined)?.total ?? 0
	return c.json({ data: listResult.results as EmailRow[], meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } })
})

app.get('/:id', async (c) => {
	const id = parseEmailId(c.req.param('id'));
	if (!id) return c.json({ error: 'Invalid id' }, 400);
	const email = await c.env.DB.prepare('SELECT id, recipient, sender, subject, body_text, body_html, received_at FROM emails WHERE id = ?').bind(id).first<EmailRow>();
	if (!email) return c.json({ error: 'Not found' }, 404);
	return c.json({ data: email });
})

app.delete('/:id', async (c) => {
	const id = parseEmailId(c.req.param('id'));
	if (!id) return c.json({ error: 'Invalid id' }, 400);
	const result = await c.env.DB.prepare('DELETE FROM emails WHERE id = ?').bind(id).run();
	if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
	return c.json({ success: true });
})

const bulkDeleteSchema = z.array(z.number().int().positive()).min(1).max(100)
app.delete('/', zValidator('json', bulkDeleteSchema), async (c) => {
	const ids = c.req.valid('json')
	const placeholders = ids.map(() => '?').join(', ')
	const result = await c.env.DB.prepare(`DELETE FROM emails WHERE id IN (${placeholders})`).bind(...ids).run()
	return c.json({ success: true, deleted: result.meta.changes })
})

export default app
