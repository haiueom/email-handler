import { Hono } from 'hono'
import { handleEmail } from './email'
import emails from './routes/emails'
import { errorHandler } from './middleware/error-handler'
import { auth } from './middleware/auth'

const app = new Hono<{ Bindings: Env }>()
app.onError(errorHandler)
app.use('/api/*', auth)
app.route('/api/email', emails)

export default {
	fetch: app.fetch,
	email: handleEmail,
} satisfies ExportedHandler<Env>
