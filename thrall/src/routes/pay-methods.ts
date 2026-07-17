import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { payMethods } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requirePaid } from '../middleware/requirePaid'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { serializePayMethod } from '../serializers/pay-method'

export const payMethodsRoutes = new Hono<AppEnv>()
payMethodsRoutes.use('*', authMiddleware, requirePaid)

const bodySchema = z.object({
  code: z.string().min(1).toUpperCase(),
  displayName: z.string().min(1),
})

payMethodsRoutes.get('/', async (c) => {
  const caller = c.get('user')
  const all = await db.query.payMethods.findMany({
    where: and(eq(payMethods.brandId, caller.brandId), isNull(payMethods.deletedAt)),
  })
  return c.json(all.map((pm) => serializePayMethod(pm, caller.role)))
})

payMethodsRoutes.post('/', requireRole('admin'), zValidator('json', bodySchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')
  const id = newId()
  const now = Date.now()

  await db.insert(payMethods).values({ id, brandId: caller.brandId, ...data, isActive: 1, createdAt: now, updatedAt: now })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'pay_method', entityId: id })

  return c.json(serializePayMethod({ id, ...data, isActive: 1 }, caller.role), 201)
})

payMethodsRoutes.put('/:id', requireRole('admin'), zValidator('json', bodySchema.partial()), async (c) => {
  const caller = c.get('user')

  const existing = await db.query.payMethods.findFirst({
    where: and(eq(payMethods.id, c.req.param('id')), eq(payMethods.brandId, caller.brandId), isNull(payMethods.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Date.now()
  await db.update(payMethods).set({ ...c.req.valid('json'), updatedAt: now }).where(eq(payMethods.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'pay_method', entityId: c.req.param('id') })
  const updated = await db.query.payMethods.findFirst({ where: eq(payMethods.id, c.req.param('id')) })
  return c.json(serializePayMethod(updated!, caller.role))
})

payMethodsRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const caller = c.get('user')

  const existing = await db.query.payMethods.findFirst({
    where: and(eq(payMethods.id, c.req.param('id')!), eq(payMethods.brandId, caller.brandId), isNull(payMethods.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Date.now()
  await db.update(payMethods).set({ deletedAt: now, updatedAt: now }).where(eq(payMethods.id, c.req.param('id')!))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'pay_method', entityId: c.req.param('id')! })
  return c.json({ ok: true })
})
