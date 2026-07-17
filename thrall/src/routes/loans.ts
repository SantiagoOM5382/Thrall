import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { loans } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requirePaid } from '../middleware/requirePaid'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { getTodayRangeInBogota } from '../lib/timezone'
import { findModelInBrand, modelIdsForBrand } from '../lib/brand-scope'

export const loansRoutes = new Hono<AppEnv>()
loansRoutes.use('*', authMiddleware, requirePaid)

const createSchema = z.object({
  modelId: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().min(1),
})

loansRoutes.get('/', async (c) => {
  const caller = c.get('user')
  const brandModelIds = await modelIdsForBrand(caller.brandId)

  if (caller.role === 'admin') {
    const all = brandModelIds.length === 0 ? [] : await db.query.loans.findMany({
      where: (l, { inArray: inArrayFn }) => inArrayFn(l.modelId, brandModelIds),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
    })
    return c.json(all)
  }

  const { start, end } = getTodayRangeInBogota()
  if (caller.role === 'monitor') {
    const today = brandModelIds.length === 0 ? [] : await db.query.loans.findMany({
      where: (l, { and, between, isNull, inArray: inArrayFn }) =>
        and(inArrayFn(l.modelId, brandModelIds), between(l.createdAt, start, end), isNull(l.deletedAt)),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
    })
    return c.json(today)
  }

  const own = await db.query.loans.findMany({
    where: (l, { and, eq: eqFn, between, isNull }) =>
      and(eqFn(l.modelId, caller.sub), between(l.createdAt, start, end), isNull(l.deletedAt)),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  })
  return c.json(own)
})

loansRoutes.post('/', requireRole('admin', 'monitor'), zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')

  const model = await findModelInBrand(data.modelId, caller.brandId)
  if (!model) return c.json({ error: 'Model not found' }, 404)

  const id = newId()
  const now = Date.now()
  await db.insert(loans).values({
    id, modelId: data.modelId, amount: data.amount, reason: data.reason,
    createdBy: caller.sub, createdAt: now,
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'loan', entityId: id })

  const created = await db.query.loans.findFirst({ where: eq(loans.id, id) })
  return c.json(created, 201)
})

const amountSchema = z.object({ amount: z.number().int().positive() })

loansRoutes.put('/:id', requireRole('admin', 'monitor'), zValidator('json', amountSchema), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')!
  const { amount } = c.req.valid('json')

  const existing = await db.query.loans.findFirst({
    where: (l, { and, eq: eqFn, isNull }) => and(eqFn(l.id, id), isNull(l.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const ownerModel = await findModelInBrand(existing.modelId, caller.brandId)
  if (!ownerModel) return c.json({ error: 'Not found' }, 404)

  await db.update(loans).set({ amount }).where(eq(loans.id, id))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'loan', entityId: id })
  const updated = await db.query.loans.findFirst({ where: eq(loans.id, id) })
  return c.json(updated)
})

loansRoutes.delete('/:id', requireRole('admin', 'monitor'), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')!

  const existing = await db.query.loans.findFirst({
    where: (l, { and, eq: eqFn, isNull }) => and(eqFn(l.id, id), isNull(l.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const ownerModel = await findModelInBrand(existing.modelId, caller.brandId)
  if (!ownerModel) return c.json({ error: 'Not found' }, 404)

  await db.update(loans).set({ deletedAt: Date.now() }).where(eq(loans.id, id))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'loan', entityId: id })
  return c.json({ ok: true })
})
