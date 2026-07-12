import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { fines, users } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { getTodayRangeInBogota } from '../lib/timezone'

export const finesRoutes = new Hono<AppEnv>()
finesRoutes.use('*', authMiddleware)

const createSchema = z.object({
  modelId: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().min(1),
})

finesRoutes.get('/', async (c) => {
  const caller = c.get('user')

  if (caller.role === 'admin') {
    const all = await db.query.fines.findMany({
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    })
    return c.json(all)
  }

  const { start, end } = getTodayRangeInBogota()
  if (caller.role === 'monitor') {
    const today = await db.query.fines.findMany({
      where: (f, { and, between, isNull }) =>
        and(between(f.createdAt, start, end), isNull(f.deletedAt)),
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    })
    return c.json(today)
  }

  // model — own fines today
  const own = await db.query.fines.findMany({
    where: (f, { and, eq: eqFn, between, isNull }) =>
      and(eqFn(f.modelId, caller.sub), between(f.createdAt, start, end), isNull(f.deletedAt)),
    orderBy: (f, { desc }) => [desc(f.createdAt)],
  })
  return c.json(own)
})

finesRoutes.post('/', requireRole('admin', 'monitor'), zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')

  const model = await db.query.users.findFirst({
    where: (u, { and, eq: eqFn, isNull }) =>
      and(eqFn(u.id, data.modelId), eqFn(u.role, 'model'), isNull(u.deletedAt)),
  })
  if (!model) return c.json({ error: 'Model not found' }, 404)

  const id = newId()
  const now = Date.now()
  await db.insert(fines).values({
    id, modelId: data.modelId, amount: data.amount, reason: data.reason,
    createdBy: caller.sub, createdAt: now,
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'fine', entityId: id })

  const created = await db.query.fines.findFirst({ where: eq(fines.id, id) })
  return c.json(created, 201)
})

const amountSchema = z.object({ amount: z.number().int().positive() })

finesRoutes.put('/:id', requireRole('admin'), zValidator('json', amountSchema), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')!
  const { amount } = c.req.valid('json')

  const existing = await db.query.fines.findFirst({
    where: (f, { and, eq: eqFn, isNull }) => and(eqFn(f.id, id), isNull(f.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.update(fines).set({ amount }).where(eq(fines.id, id))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'fine', entityId: id })
  const updated = await db.query.fines.findFirst({ where: eq(fines.id, id) })
  return c.json(updated)
})

finesRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')!

  const existing = await db.query.fines.findFirst({
    where: (f, { and, eq: eqFn, isNull }) => and(eqFn(f.id, id), isNull(f.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.update(fines).set({ deletedAt: Date.now() }).where(eq(fines.id, id))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'fine', entityId: id })
  return c.json({ ok: true })
})
