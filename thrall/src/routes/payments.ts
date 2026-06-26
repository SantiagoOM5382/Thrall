import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { payments } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'

export const paymentsRoutes = new Hono<AppEnv>()
paymentsRoutes.use('*', authMiddleware, requireRole('admin'))

const createSchema = z.object({
  modelId: z.string(),
  amount: z.number().int().positive(),
  payMethodId: z.string(),
})

paymentsRoutes.get('/', async (c) => {
  const modelId = c.req.query('modelId')
  if (!modelId) return c.json({ error: 'modelId is required' }, 400)
  const list = await db.query.payments.findMany({
    where: (p, { eq: eqFn }) => eqFn(p.modelId, modelId),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })
  return c.json(list)
})

paymentsRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')

  const model = await db.query.users.findFirst({
    where: (u, { and, eq: eqFn, isNull }) =>
      and(eqFn(u.id, data.modelId), eqFn(u.role, 'model'), isNull(u.deletedAt)),
  })
  if (!model) return c.json({ error: 'Model not found' }, 404)

  const id = newId()
  await db.insert(payments).values({
    id, modelId: data.modelId, amount: data.amount,
    payMethodId: data.payMethodId, createdBy: caller.sub, createdAt: Date.now(),
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'payment', entityId: id })

  const created = await db.query.payments.findFirst({ where: eq(payments.id, id) })
  return c.json(created, 201)
})
