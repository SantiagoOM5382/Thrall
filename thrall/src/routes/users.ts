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
usersRoutes.use('*', authMiddleware, requireRole('admin', 'dev'))

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'monitor', 'model', 'dev']),
  brandId: z.string().optional(),
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
  const caller = c.get('user')
  const brandFilter = c.req.query('brandId')
  const all = await db.query.users.findMany({
    where: (u, { and, eq: eqFn, isNull }) => {
      const conds = [isNull(u.deletedAt)]
      if (caller.role === 'dev') {
        if (brandFilter) conds.push(eqFn(u.brandId, brandFilter))
      } else {
        conds.push(eqFn(u.brandId, caller.brandId))
      }
      return and(...conds)
    },
  })
  return c.json(all.map(omitPassword))
})

usersRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json')
  const caller = c.get('user')

  // Only a dev may create dev users; an admin creating a dev would escalate to
  // a cross-brand superuser, bypassing tenant isolation.
  if (data.role === 'dev' && caller.role !== 'dev') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const targetBrandId = caller.role === 'dev' ? data.brandId : caller.brandId
  if (!targetBrandId) return c.json({ error: 'brandId is required' }, 400)

  // Dev supplies the target brand from the body; verify it exists (FKs are not
  // enforced by libsql by default).
  if (caller.role === 'dev') {
    const brand = await db.query.brands.findFirst({
      where: (b, { eq: eqFn }) => eqFn(b.id, targetBrandId),
    })
    if (!brand) return c.json({ error: 'Brand not found' }, 404)
  }

  const id = newId()
  const now = Date.now()
  const { brandId: _ignored, ...rest } = data
  await db.insert(users).values({
    id,
    ...rest,
    brandId: targetBrandId,
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
  if (caller.sub === c.req.param('id')) {
    return c.json({ error: 'Cannot delete own account' }, 400)
  }
  const existing = await db.query.users.findFirst({
    where: (u, { and, eq, isNull }) => and(eq(u.id, c.req.param('id')), isNull(u.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Date.now()
  await db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'user', entityId: c.req.param('id') })
  return c.json({ ok: true })
})
