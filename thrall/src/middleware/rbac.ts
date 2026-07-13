import type { Context, Next } from 'hono'
import type { AppEnv } from './auth'

export function requireRole(...roles: Array<'admin' | 'monitor' | 'model' | 'dev'>) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}
