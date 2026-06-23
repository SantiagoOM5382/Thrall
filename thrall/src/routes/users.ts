import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { hashPassword } from '../lib/hash'
import { logAudit } from '../lib/audit'

export const usersRoutes = new Hono<AppEnv>()
usersRoutes.use('*', authMiddleware, requireRole('admin'))

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'monitor', 'model']),
  brandId: z.string(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().optional(),
})

const updateSchema = createSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
})

function omitPassword<T extends { password?: string }>(u: T): Omit<T, 'password'> {
  const { password: _, ...rest } = u
  return rest
}

usersRoutes.get('/', async (c) => {
  const all = await db.query.users.findMany({
    where: (u, { isNull }) => isNull(u.deletedAt),
  })
  return c.json(all.map(omitPassword))
})

usersRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json')
  const caller = c.get('user')
  const id = newId()
  const now = Date.now()

  await db.insert(users).values({
    id,
    ...data,
    password: await hashPassword(data.password),
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  })

  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'user', entityId: id })

  const created = await db.query.users.findFirst({ where: eq(users.id, id) })
  return c.json(omitPassword(created!), 201)
})

usersRoutes.get('/:id', async (c) => {
  const user = await db.query.users.findFirst({
    where: (u, { and, eq, isNull }) => and(eq(u.id, c.req.param('id')), isNull(u.deletedAt)),
  })
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(omitPassword(user))
})

usersRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const caller = c.get('user')
  const existing = await db.query.users.findFirst({
    where: (u, { and, eq, isNull }) => and(eq(u.id, c.req.param('id')), isNull(u.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const data = c.req.valid('json')
  const now = Date.now()
  const patch: Record<string, unknown> = { ...data, updatedAt: now }
  if (data.password) patch.password = await hashPassword(data.password)

  await db.update(users).set(patch).where(eq(users.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'user', entityId: c.req.param('id') })

  const updated = await db.query.users.findFirst({ where: eq(users.id, c.req.param('id')) })
  return c.json(omitPassword(updated!))
})

usersRoutes.delete('/:id', async (c) => {
  const caller = c.get('user')
  const existing = await db.query.users.findFirst({
    where: (u, { and, eq, isNull }) => and(eq(u.id, c.req.param('id')), isNull(u.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Date.now()
  await db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'user', entityId: c.req.param('id') })
  return c.json({ ok: true })
})
