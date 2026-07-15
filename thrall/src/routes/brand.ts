import { Hono } from 'hono'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { loadBrandAccess } from '../middleware/requirePaid'

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

brandRoutes.post('/subscribe', async (c) => {
  return c.json({ error: 'not_implemented' }, 501)
})
