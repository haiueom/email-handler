import { z } from 'zod'

// --- Response schemas ---

export const emailSummarySchema = z.object({
	id: z.number().int().openapi({ example: 1 }),
	sender: z.string().openapi({ example: 'sender@example.com' }),
	recipient: z.string().openapi({ example: 'you@example.com' }),
	subject: z.string().openapi({ example: 'Your verification code' }),
	received_at: z.string().openapi({ example: '2026-09-29 10:00:00' }),
})

export const emailDetailSchema = z.object({
	id: z.number().int().openapi({ example: 1 }),
	sender: z.string().openapi({ example: 'sender@example.com' }),
	recipient: z.string().openapi({ example: 'you@example.com' }),
	subject: z.string().openapi({ example: 'Your verification code' }),
	body_text: z.string().openapi({ example: 'Your code is 123456' }),
	body_html: z.string().openapi({ example: '<p>Your code is <b>123456</b></p>' }),
	received_at: z.string().openapi({ example: '2026-09-29 10:00:00' }),
})

export const errorSchema = z.object({
	error: z.string().openapi({ example: 'Not found' }),
})

// --- Request schemas ---

export const listEmailsQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
	limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
	search: z.string().optional().openapi({ example: 'verification' }),
})

export const bulkDeleteSchema = z.array(z.number().int().positive()).min(1).max(100).openapi({ example: [1, 2, 3] })

// --- Composite response schemas ---

export const emailListResponseSchema = z.object({
	data: z.array(emailSummarySchema),
	meta: z.object({
		total: z.number().int().openapi({ example: 100 }),
		page: z.number().int().openapi({ example: 1 }),
		limit: z.number().int().openapi({ example: 20 }),
		totalPages: z.number().int().openapi({ example: 5 }),
	}),
})

export const emailDetailResponseSchema = z.object({
	data: emailDetailSchema,
})

export const deleteResponseSchema = z.object({
	success: z.boolean().openapi({ example: true }),
})

export const bulkDeleteResponseSchema = z.object({
	success: z.boolean().openapi({ example: true }),
	deleted: z.number().int().openapi({ example: 3 }),
})
