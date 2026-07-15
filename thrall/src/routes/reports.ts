import { Hono } from 'hono'
import { eq, and, between, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { services, serviceExtras, users, fines, loans, payments, brands } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requirePaid } from '../middleware/requirePaid'
import { requireRole } from '../middleware/rbac'
import { calcEarnings } from '../lib/earnings'
import { getTodayRangeInBogota } from '../lib/timezone'

export const reportsRoutes = new Hono<AppEnv>()
reportsRoutes.use('*', authMiddleware, requirePaid)

reportsRoutes.get('/ranking', requireRole('admin', 'monitor'), async (c) => {
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

reportsRoutes.get('/model-balance/:id', requireRole('admin'), async (c) => {
  const modelId = c.req.param('id')!

  const modelServices = await db.query.services.findMany({
    where: (s, { and, eq: eqFn, isNull }) => and(eqFn(s.modelId, modelId), isNull(s.deletedAt)),
  })
  let totalEarnings = 0
  for (const s of modelServices) {
    const extras = await db.query.serviceExtras.findMany({
      where: eq(serviceExtras.serviceId, s.id),
    })
    totalEarnings += calcEarnings(s.basePrice, extras.map((x) => x.amount)).modelTotal
  }

  const modelFines = await db.query.fines.findMany({
    where: (f, { and, eq: eqFn, isNull }) => and(eqFn(f.modelId, modelId), isNull(f.deletedAt)),
  })
  const totalFines = modelFines.reduce((sum, f) => sum + f.amount, 0)

  const modelLoans = await db.query.loans.findMany({
    where: (l, { and, eq: eqFn, isNull }) => and(eqFn(l.modelId, modelId), isNull(l.deletedAt)),
  })
  const totalLoans = modelLoans.reduce((sum, l) => sum + l.amount, 0)

  const modelPayments = await db.query.payments.findMany({
    where: (p, { eq: eqFn }) => eqFn(p.modelId, modelId),
  })
  const totalPayments = modelPayments.reduce((sum, p) => sum + p.amount, 0)

  return c.json({
    balance: totalEarnings - totalFines - totalLoans - totalPayments,
    totalEarnings,
    totalFines,
    totalLoans,
    totalPayments,
  })
})

reportsRoutes.get('/brand-earnings', requireRole('dev'), async (c) => {
  const from = Number(c.req.query('from') ?? 0)
  const to = Number(c.req.query('to') ?? Date.now())

  const allBrands = await db.query.brands.findMany({ orderBy: (b, { asc }) => [asc(b.name)] })
  const models = await db.query.users.findMany({ where: (u, { eq: eqFn }) => eqFn(u.role, 'model') })
  const modelBrand = new Map(models.map((m) => [m.id, m.brandId]))

  const svcs = await db.query.services.findMany({
    where: (s, { and, between, isNull }) => and(between(s.startTime, from, to), isNull(s.deletedAt)),
  })

  const acc = new Map<string, { totalServices: number; totalBase: number; companyEarnings: number; modelTotalEarnings: number }>()
  for (const b of allBrands) acc.set(b.id, { totalServices: 0, totalBase: 0, companyEarnings: 0, modelTotalEarnings: 0 })

  for (const s of svcs) {
    const brandId = modelBrand.get(s.modelId)
    if (!brandId || !acc.has(brandId)) continue
    const extras = await db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, s.id) })
    const e = calcEarnings(s.basePrice, extras.map((x) => x.amount))
    const a = acc.get(brandId)!
    a.totalServices += 1
    a.totalBase += s.basePrice
    a.companyEarnings += e.company
    a.modelTotalEarnings += e.modelTotal
  }

  const rows = allBrands.map((b) => ({ brandId: b.id, brandName: b.name, ...acc.get(b.id)! }))
  const totals = rows.reduce(
    (t, r) => ({
      totalServices: t.totalServices + r.totalServices,
      totalBase: t.totalBase + r.totalBase,
      companyEarnings: t.companyEarnings + r.companyEarnings,
      modelTotalEarnings: t.modelTotalEarnings + r.modelTotalEarnings,
    }),
    { totalServices: 0, totalBase: 0, companyEarnings: 0, modelTotalEarnings: 0 }
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
