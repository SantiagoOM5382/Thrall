import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { products, purchases } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { loadBrandAccess } from '../middleware/requirePaid'
import { newId } from '../lib/ulid'
import { buildCheckoutUrl } from '../lib/wompi'

export const brandRoutes = new Hono<AppEnv>()
brandRoutes.use('*', authMiddleware)

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
