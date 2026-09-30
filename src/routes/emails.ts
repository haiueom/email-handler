import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import {
	bulkDeleteSchema,
	bulkDeleteResponseSchema,
	deleteResponseSchema,
	emailDetailSchema,
	emailDetailResponseSchema,
	emailListResponseSchema,
	emailSummarySchema,
	errorSchema,
	listEmailsQuerySchema,
} from '../schemas'

const app = new OpenAPIHono<{ Bindings: Env }>()

function parseEmailId(id: string): number | null {
	const parsed = Number(id)
	return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null
}

// GET /api/email
const listRoute = createRoute({
	method: 'get',
	path: '/',
	summary: 'List emails',
	description: 'Returns a paginated list of stored emails, newest first. Search matches subject or sender.',
	tags: ['Emails'],
	request: { query: listEmailsQuerySchema },
	responses: {
		200: {
			content: { 'application/json': { schema: emailListResponseSchema } },
			description: 'Email list with pagination metadata',
		},
	},
})

app.openapi(listRoute, async (c) => {
	const { page, limit, search } = c.req.valid('query')
	const offset = (page - 1) * limit
	const escapeChar = '\\'
	const condition = search ? `WHERE subject LIKE ? ESCAPE '${escapeChar}' OR sender LIKE ? ESCAPE '${escapeChar}'` : ''
	const escapedSearch = search?.replace(/[%_\\]/g, `${escapeChar}$&`) ?? ''
	const searchParams: unknown[] = search ? [`%${escapedSearch}%`, `%${escapedSearch}%`] : []

	const [countResult, listResult] = await c.env.DB.batch([
		c.env.DB.prepare(`SELECT COUNT(*) as total FROM emails ${condition}`).bind(...searchParams),
		c.env.DB.prepare(`SELECT id, sender, recipient, subject, received_at FROM emails ${condition} ORDER BY received_at DESC LIMIT ? OFFSET ?`).bind(...searchParams, limit, offset),
	])

	const total = (countResult.results[0] as { total: number } | undefined)?.total ?? 0
	const data = listResult.results as unknown as z.infer<typeof emailSummarySchema>[]
	return c.json({ data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } }, 200)
})

// GET /api/email/:id
const getByIdRoute = createRoute({
	method: 'get',
	path: '/{id}',
	summary: 'Get email by ID',
	description: 'Returns the full email record including body text, HTML, and metadata.',
	tags: ['Emails'],
	request: {
		params: z.object({
			id: z.string().openapi({ example: '1' }),
		}),
	},
	responses: {
		200: {
			content: { 'application/json': { schema: emailDetailResponseSchema } },
			description: 'Email detail',
		},
		400: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid ID format' },
		404: { content: { 'application/json': { schema: errorSchema } }, description: 'Email not found' },
	},
})

app.openapi(getByIdRoute, async (c) => {
	const { id } = c.req.valid('param')
	const parsedId = parseEmailId(id)
	if (!parsedId) return c.json({ error: 'Invalid id' }, 400)

	const email = await c.env.DB.prepare('SELECT id, recipient, sender, subject, body_text, body_html, received_at FROM emails WHERE id = ?').bind(parsedId).first()
	if (!email) return c.json({ error: 'Not found' }, 404)

	return c.json({ data: email as unknown as z.infer<typeof emailDetailSchema> }, 200)
})

// DELETE /api/email/:id
const deleteByIdRoute = createRoute({
	method: 'delete',
	path: '/{id}',
	summary: 'Delete email by ID',
	description: 'Permanently deletes a single email from D1 storage.',
	tags: ['Emails'],
	request: {
		params: z.object({
			id: z.string().openapi({ example: '1' }),
		}),
	},
	responses: {
		200: {
			content: { 'application/json': { schema: deleteResponseSchema } },
			description: 'Email deleted',
		},
		400: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid ID format' },
		404: { content: { 'application/json': { schema: errorSchema } }, description: 'Email not found' },
	},
})

app.openapi(deleteByIdRoute, async (c) => {
	const { id } = c.req.valid('param')
	const parsedId = parseEmailId(id)
	if (!parsedId) return c.json({ error: 'Invalid id' }, 400)

	const result = await c.env.DB.prepare('DELETE FROM emails WHERE id = ?').bind(parsedId).run()
	if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)

	return c.json({ success: true }, 200)
})

// DELETE /api/email
const bulkDeleteRoute = createRoute({
	method: 'delete',
	path: '/',
	summary: 'Bulk delete emails',
	description: 'Deletes up to 100 emails in a single request.',
	tags: ['Emails'],
	request: {
		body: {
			content: { 'application/json': { schema: bulkDeleteSchema } },
		},
	},
	responses: {
		200: {
			content: { 'application/json': { schema: bulkDeleteResponseSchema } },
			description: 'Emails deleted',
		},
	},
})

app.openapi(bulkDeleteRoute, async (c) => {
	const ids = c.req.valid('json')
	const placeholders = ids.map(() => '?').join(', ')
	const result = await c.env.DB.prepare(`DELETE FROM emails WHERE id IN (${placeholders})`).bind(...ids).run()
	return c.json({ success: true, deleted: result.meta.changes }, 200)
})

export default app
