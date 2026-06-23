import type { Context, Next } from 'hono'
import { verifyToken, type TokenPayload } from '../lib/jwt'

export type AppEnv = {
  Variables: {
    user: TokenPayload
  }
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = header.slice(7)
  try {
    const payload = await verifyToken(token)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}
