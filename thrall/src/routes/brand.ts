import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, desc, eq, lt } from 'drizzle-orm'
import { db } from '../db/client'
import { products, purchases, brandWallets, walletTransactions } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { loadBrandAccess } from '../middleware/requirePaid'
import { newId } from '../lib/ulid'
import { buildCheckoutUrl } from '../lib/wompi'
import { applyDiscount } from '../lib/wallet'

export const brandRoutes = new Hono<AppEnv>()
brandRoutes.use('*', authMiddleware)

async function resolveTokenDiscountPercent(brandId: string): Promise<number> {
  const latest = await db
    .select({ tokenDiscountPercent: products.tokenDiscountPercent })
    .from(purchases)
    .innerJoin(products, eq(products.id, purchases.productId))
    .where(and(
      eq(purchases.brandId, brandId),
      eq(purchases.status, 'APPROVED'),
      eq(products.type, 'SUBSCRIPTION'),
    ))
    .orderBy(desc(purchases.createdAt))
    .limit(1)
  return latest[0]?.tokenDiscountPercent ?? 0
}

brandRoutes.get('/subscription', async (c) => {
  const user = c.get('user')
  const { sub, isPaidEffective } = await loadBrandAccess(user.brandId)
  if (!sub) {
    return c.json({
      tier: 'free', status: 'expired',
      trialEndsAt: null, paidUntil: null,
      isGrandfathered: false, isPaidEffective: false, daysLeft: null,
    })
  }
  const now = Date.now()
  const activeAt = sub.status === 'trial' ? sub.trialEndsAt
                 : sub.tier === 'paid'    ? sub.paidUntil
                 : null
  const daysLeft = activeAt && activeAt > now
    ? Math.ceil((activeAt - now) / (86400 * 1000))
    : null
  return c.json({
    tier: sub.tier,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    paidUntil: sub.paidUntil,
    isGrandfathered: sub.isGrandfathered === 1,
    isPaidEffective,
    daysLeft,
  })
})

const subscribeSchema = z.object({ productId: z.string().min(1) })

brandRoutes.post('/subscribe', zValidator('json', subscribeSchema), async (c) => {
  const user = c.get('user')
  const { productId } = c.req.valid('json')

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.isActive, 1)),
  })
  if (!product || product.type !== 'SUBSCRIPTION' || product.durationDays == null) {
    return c.json({ error: 'invalid_product' }, 400)
  }

  const pub = process.env.WOMPI_PUBLIC_KEY
  const integrity = process.env.WOMPI_INTEGRITY_SECRET
  const sylvanas = process.env.SYLVANAS_URL
  if (!pub || !integrity || !sylvanas) {
    return c.json({ error: 'wompi_not_configured' }, 500)
  }

  const reference = newId()
  const now = Date.now()
  await db.insert(purchases).values({
    id: newId(),
    brandId: user.brandId,
    productId: product.id,
    userId: user.sub,
    amountCop: product.priceCop,
    status: 'PENDING',
    wompiReference: reference,
    createdAt: now,
    updatedAt: now,
  })

  const checkoutUrl = buildCheckoutUrl({
    publicKey: pub,
    integritySecret: integrity,
    reference,
    amountInCents: product.priceCop * 100,
    currency: 'COP',
    redirectUrl: `${sylvanas}/dashboard/subscribe/success`,
  })

  return c.json({ checkoutUrl })
})

brandRoutes.get('/purchases/latest', async (c) => {
  const user = c.get('user')
  const row = await db
    .select({
      id: purchases.id,
      productCode: products.code,
      amountCop: purchases.amountCop,
      status: purchases.status,
      wompiReference: purchases.wompiReference,
      paidAt: purchases.paidAt,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(products, eq(products.id, purchases.productId))
    .where(eq(purchases.brandId, user.brandId))
    .orderBy(desc(purchases.createdAt))
    .limit(1)
  return c.json({ latest: row[0] ?? null })
})

brandRoutes.get('/wallet', async (c) => {
  const user = c.get('user')
  const wallet = await db.query.brandWallets.findFirst({ where: eq(brandWallets.brandId, user.brandId) })
  const tokenDiscountPercent = await resolveTokenDiscountPercent(user.brandId)
  return c.json({ tokensBalance: wallet?.tokensBalance ?? 0, tokenDiscountPercent })
})

brandRoutes.get('/wallet/transactions', async (c) => {
  const user = c.get('user')
  const limitParam = Number(c.req.query('limit') ?? '20')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20
  const beforeParam = c.req.query('before')
  const conditions = [eq(walletTransactions.brandId, user.brandId)]
  if (beforeParam) conditions.push(lt(walletTransactions.createdAt, Number(beforeParam)))
  const rows = await db
    .select()
    .from(walletTransactions)
    .where(and(...conditions))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit)
  return c.json({ transactions: rows })
})
