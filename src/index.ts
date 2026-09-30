import { OpenAPIHono } from '@hono/zod-openapi'
import { handleEmail } from './email'
import emails from './routes/emails'
import { errorHandler } from './middleware/error-handler'
import { auth } from './middleware/auth'
import { Scalar } from '@scalar/hono-api-reference'

const app = new OpenAPIHono<{ Bindings: Env }>()
app.onError(errorHandler)
app.use('/api/*', auth)
app.route('/api/email', emails)

// OpenAPI spec + docs (public: spec has no secrets, only schema metadata)
app.doc('/openapi.json', {
	openapi: '3.0.0',
	info: {
		title: 'Email Handler API',
		version: '1.0.0',
		description: 'Serverless Cloudflare Email Worker — parses incoming emails, stores in D1, posts summaries to Discord.',
	},
	servers: [{ url: 'https://email-handler.<your-subdomain>.workers.dev', description: 'Production' }],
})

app.get('/docs', Scalar({ url: '/openapi.json', theme: 'purple' }))

export default {
	fetch: app.fetch,
	email: handleEmail,
} satisfies ExportedHandler<Env>
