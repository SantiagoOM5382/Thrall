import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../db/schema'
import { comparePassword } from '../lib/hash'
import { signToken } from '../lib/jwt'
import { authMiddleware, type AppEnv } from '../middleware/auth'

export const authRoutes = new Hono<AppEnv>()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (!user || user.isActive === 0 || user.deletedAt !== null) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const valid = await comparePassword(password, user.password)
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = await signToken({
    sub: user.id,
    role: user.role,
    brandId: user.brandId,
    name: user.name,
  })

  return c.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, brandId: user.brandId },
  })
})

authRoutes.get('/me', authMiddleware, (c) => {
  const user = c.get('user')
  return c.json({ id: user.sub, name: user.name, role: user.role, brandId: user.brandId })
})
