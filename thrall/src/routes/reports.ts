import { Hono } from 'hono'
import { eq, and, between, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { services, serviceExtras, users } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { calcEarnings } from '../lib/earnings'
import { getTodayRangeInBogota } from '../lib/timezone'

export const reportsRoutes = new Hono<AppEnv>()
reportsRoutes.use('*', authMiddleware)

reportsRoutes.get('/ranking', async (c) => {
  const all = await db.query.services.findMany({
    where: (s, { isNull }) => isNull(s.deletedAt),
  })

  const countByModel: Record<string, { modelId: string; count: number; totalBase: number }> = {}
  for (const s of all) {
    if (!countByModel[s.modelId]) {
      countByModel[s.modelId] = { modelId: s.modelId, count: 0, totalBase: 0 }
    }
    countByModel[s.modelId].count++
    countByModel[s.modelId].totalBase += s.basePrice
  }

  const ranked = await Promise.all(
    Object.values(countByModel)
      .sort((a, b) => b.count - a.count)
      .map(async (entry, i) => {
        const model = await db.query.users.findFirst({ where: eq(users.id, entry.modelId) })
        return {
          position: i + 1,
          modelId: entry.modelId,
          name: model?.name ?? 'Unknown',
          serviceCount: entry.count,
          totalBase: entry.totalBase,
        }
      })
  )

  return c.json(ranked)
})

reportsRoutes.get('/earnings', requireRole('admin'), async (c) => {
  const from = Number(c.req.query('from') ?? 0)
  const to = Number(c.req.query('to') ?? Date.now())

  const allServices = await db.query.services.findMany({
    where: (s, { and, between, isNull }) =>
      and(between(s.startTime, from, to), isNull(s.deletedAt)),
  })

  let totalBase = 0
  let companyEarnings = 0
  let modelBaseEarnings = 0
  let modelExtraEarnings = 0

  for (const s of allServices) {
    const extras = await db.query.serviceExtras.findMany({
      where: eq(serviceExtras.serviceId, s.id),
    })
    const e = calcEarnings(s.basePrice, extras.map((x) => x.amount))
    totalBase += s.basePrice
    companyEarnings += e.company
    modelBaseEarnings += e.modelBase
    modelExtraEarnings += e.modelExtras
  }

  return c.json({
    totalServices: allServices.length,
    totalBase,
    companyEarnings,
    modelBaseEarnings,
    modelExtraEarnings,
    modelTotalEarnings: modelBaseEarnings + modelExtraEarnings,
  })
})

reportsRoutes.get('/model-earnings/:id', requireRole('admin'), async (c) => {
  const modelId = c.req.param('id')!
  const from = Number(c.req.query('from') ?? 0)
  const to = Number(c.req.query('to') ?? Date.now())

  const modelServices = await db.query.services.findMany({
    where: (s, { and, eq: eqFn, between, isNull }) =>
      and(eqFn(s.modelId, modelId), between(s.startTime, from, to), isNull(s.deletedAt)),
    orderBy: (s, { desc }) => [desc(s.startTime)],
  })

  const rows = await Promise.all(
    modelServices.map(async (s) => {
      const extras = await db.query.serviceExtras.findMany({
        where: eq(serviceExtras.serviceId, s.id),
      })
      const e = calcEarnings(s.basePrice, extras.map((x) => x.amount))
      return {
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        basePrice: s.basePrice,
        extras: extras.map((x) => ({ description: x.description, amount: x.amount })),
        modelBase: e.modelBase,
        modelExtras: e.modelExtras,
        modelTotal: e.modelTotal,
      }
    })
  )

  const totals = rows.reduce(
    (acc, r) => ({
      totalBase: acc.totalBase + r.basePrice,
      totalModelEarnings: acc.totalModelEarnings + r.modelTotal,
    }),
    { totalBase: 0, totalModelEarnings: 0 }
  )

  return c.json({ rows, totals })
})

reportsRoutes.get('/daily', requireRole('admin', 'monitor'), async (c) => {
  const { start, end } = getTodayRangeInBogota()

  const todayServices = await db.query.services.findMany({
    where: (s, { and, between, isNull }) =>
      and(between(s.startTime, start, end), isNull(s.deletedAt)),
  })

  let totalBase = 0
  let companyEarnings = 0
  let modelEarnings = 0

  for (const s of todayServices) {
    const extras = await db.query.serviceExtras.findMany({
      where: eq(serviceExtras.serviceId, s.id),
    })
    const e = calcEarnings(s.basePrice, extras.map((x) => x.amount))
    totalBase += s.basePrice
    companyEarnings += e.company
    modelEarnings += e.modelTotal
  }

  return c.json({
    date: new Date(start).toISOString().slice(0, 10),
    totalServices: todayServices.length,
    totalBase,
    companyEarnings,
    modelEarnings,
  })
})
