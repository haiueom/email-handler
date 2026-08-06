import { bearerAuth } from 'hono/bearer-auth'

export const auth = bearerAuth({ token: c => c.env.API_TOKEN })
