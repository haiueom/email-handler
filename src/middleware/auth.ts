import { bearerAuth } from 'hono/bearer-auth'
import type { Context } from 'hono'

export const auth = bearerAuth({
	verifyToken: async (token, c: Context<{ Bindings: Env }>) => {
		const received = new TextEncoder().encode(token);
		const expected = new TextEncoder().encode(c.env.API_TOKEN);
		// ponytail: length check before timingSafeEqual (it throws on length mismatch); upgrade path: none
		return received.length === expected.length && crypto.subtle.timingSafeEqual(received, expected);
	},
})
