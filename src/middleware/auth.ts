import { bearerAuth } from 'hono/bearer-auth'
import type { Context } from 'hono'

export const auth = bearerAuth({
	verifyToken: async (token, c: Context<{ Bindings: Env }>) => token === c.env.API_TOKEN,
})
