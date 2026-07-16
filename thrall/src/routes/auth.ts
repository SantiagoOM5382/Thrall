import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { users, brands, brandSubscriptions } from '../db/schema'
import { comparePassword, hashPassword } from '../lib/hash'
import { signToken } from '../lib/jwt'
import { newId } from '../lib/ulid'
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

const signupSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  adminName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
})

const TRIAL_DAYS = 10

authRoutes.post('/signup', zValidator('json', signupSchema), async (c) => {
  const data = c.req.valid('json')

  const emailTaken = await db.query.users.findFirst({ where: eq(users.email, data.email) })
  if (emailTaken) return c.json({ error: 'email_in_use' }, 409)

  const nameTaken = await db.query.brands.findFirst({
    where: sql`lower(${brands.name}) = lower(${data.brandName})`,
  })
  if (nameTaken) return c.json({ error: 'brand_name_in_use' }, 409)

  const now = Date.now()
  const brandId = newId()
  const userId = newId()
  const subId = newId()
  const trialEndsAt = now + TRIAL_DAYS * 86400 * 1000
  const hashedPassword = await hashPassword(data.password)

  try {
    await db.transaction(async (tx) => {
      await tx.insert(brands).values({
        id: brandId, name: data.brandName, isActive: 1, createdAt: now, updatedAt: now,
      })
      await tx.insert(brandSubscriptions).values({
        id: subId, brandId,
        tier: 'free', status: 'trial',
        trialEndsAt, paidUntil: null, isGrandfathered: 0,
        createdAt: now, updatedAt: now,
      })
      await tx.insert(users).values({
        id: userId, brandId,
        name: data.adminName, email: data.email,
        password: hashedPassword,
        role: 'admin', isActive: 1,
        createdAt: now, updatedAt: now,
      })
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('SQLITE_CONSTRAINT')) {
      if (message.includes('brands_name_lower_idx')) {
        return c.json({ error: 'brand_name_in_use' }, 409)
      }
      if (message.includes('users_email_idx')) {
        return c.json({ error: 'email_in_use' }, 409)
      }
    }
    throw err
  }

  const token = await signToken({ sub: userId, role: 'admin', brandId, name: data.adminName })
  return c.json({
    token,
    user: { id: userId, name: data.adminName, role: 'admin', brandId },
  })
})
