import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { payments } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requirePaid } from '../middleware/requirePaid'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { findModelInBrand, findPayMethodInBrand } from '../lib/brand-scope'

export const paymentsRoutes = new Hono<AppEnv>()
paymentsRoutes.use('*', authMiddleware, requirePaid, requireRole('admin'))

const createSchema = z.object({
  modelId: z.string(),
  amount: z.number().int().positive(),
  payMethodId: z.string(),
})

paymentsRoutes.get('/', async (c) => {
  const caller = c.get('user')
  const modelId = c.req.query('modelId')
  if (!modelId) return c.json({ error: 'modelId is required' }, 400)

  const model = await findModelInBrand(modelId, caller.brandId)
  if (!model) return c.json({ error: 'Model not found' }, 404)

  const list = await db.query.payments.findMany({
    where: (p, { eq: eqFn }) => eqFn(p.modelId, modelId),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })
  return c.json(list)
})

paymentsRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')

  const model = await findModelInBrand(data.modelId, caller.brandId)
  if (!model) return c.json({ error: 'Model not found' }, 404)

  const payMethod = await findPayMethodInBrand(data.payMethodId, caller.brandId)
  if (!payMethod) return c.json({ error: 'invalid_pay_method' }, 400)

  const id = newId()
  await db.insert(payments).values({
    id, modelId: data.modelId, amount: data.amount,
    payMethodId: data.payMethodId, createdBy: caller.sub, createdAt: Date.now(),
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'payment', entityId: id })

  const created = await db.query.payments.findFirst({ where: eq(payments.id, id) })
  return c.json(created, 201)
})
