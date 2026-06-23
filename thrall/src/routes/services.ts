import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { services, serviceExtras } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { getTodayRangeInBogota } from '../lib/timezone'

export const servicesRoutes = new Hono<AppEnv>()
servicesRoutes.use('*', authMiddleware)

const createSchema = z.object({
  modelId: z.string(),
  startTime: z.number().int(),
  endTime: z.number().int(),
  basePrice: z.number().int().positive(),
  payMethodId: z.string(),
  note: z.string().optional(),
  extras: z.array(z.object({
    description: z.string(),
    amount: z.number().int().positive(),
  })).default([]),
})

async function getServiceWithExtras(id: string) {
  const service = await db.query.services.findFirst({ where: eq(services.id, id) })
  if (!service) return null
  const extras = await db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, id) })
  return { ...service, extras }
}

servicesRoutes.get('/', async (c) => {
  const caller = c.get('user')
  const { start, end } = getTodayRangeInBogota()

  if (caller.role === 'admin') {
    const all = await db.query.services.findMany({
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    })
    const withExtras = await Promise.all(all.map((s) =>
      db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, s.id) })
        .then((extras) => ({ ...s, extras }))
    ))
    return c.json(withExtras)
  }

  if (caller.role === 'monitor') {
    const todayServices = await db.query.services.findMany({
      where: (s, { and, between, isNull }) =>
        and(between(s.startTime, start, end), isNull(s.deletedAt)),
      orderBy: (s, { desc }) => [desc(s.startTime)],
    })
    const withExtras = await Promise.all(todayServices.map((s) =>
      db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, s.id) })
        .then((extras) => ({ ...s, extras }))
    ))
    return c.json(withExtras)
  }

  // model — only own services today
  const ownServices = await db.query.services.findMany({
    where: (s, { and, eq: eqFn, between, isNull }) =>
      and(eqFn(s.modelId, caller.sub), between(s.startTime, start, end), isNull(s.deletedAt)),
    orderBy: (s, { desc }) => [desc(s.startTime)],
  })
  const withExtras = await Promise.all(ownServices.map((s) =>
    db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, s.id) })
      .then((extras) => ({ ...s, extras }))
  ))
  return c.json(withExtras)
})

servicesRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  if (!['admin', 'monitor'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const data = c.req.valid('json')
  const id = newId()
  const now = Date.now()

  await db.insert(services).values({
    id,
    modelId: data.modelId,
    createdBy: caller.sub,
    startTime: data.startTime,
    endTime: data.endTime,
    basePrice: data.basePrice,
    payMethodId: data.payMethodId,
    note: data.note ?? null,
    createdAt: now,
    updatedAt: now,
  })

  for (const extra of data.extras) {
    await db.insert(serviceExtras).values({
      id: newId(),
      serviceId: id,
      description: extra.description,
      amount: extra.amount,
      createdAt: now,
    })
  }

  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'service', entityId: id })

  const result = await getServiceWithExtras(id)
  return c.json(result, 201)
})

servicesRoutes.put('/:id', zValidator('json', createSchema.partial()), async (c) => {
  const caller = c.get('user')
  if (!['admin', 'monitor'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const existing = await getServiceWithExtras(c.req.param('id'))
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const data = c.req.valid('json')
  const now = Date.now()
  const { extras, ...serviceData } = data

  await db.update(services).set({ ...serviceData, updatedAt: now }).where(eq(services.id, c.req.param('id')))

  if (extras !== undefined) {
    await db.delete(serviceExtras).where(eq(serviceExtras.serviceId, c.req.param('id')))
    for (const extra of extras) {
      await db.insert(serviceExtras).values({
        id: newId(),
        serviceId: c.req.param('id'),
        description: extra.description,
        amount: extra.amount,
        createdAt: now,
      })
    }
  }

  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'service', entityId: c.req.param('id') })
  return c.json(await getServiceWithExtras(c.req.param('id')))
})

servicesRoutes.delete('/:id', async (c) => {
  const caller = c.get('user')
  if (!['admin', 'monitor'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const existing = await getServiceWithExtras(c.req.param('id'))
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Date.now()
  await db.update(services).set({ deletedAt: now, updatedAt: now }).where(eq(services.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'service', entityId: c.req.param('id') })
  return c.json({ ok: true })
})
