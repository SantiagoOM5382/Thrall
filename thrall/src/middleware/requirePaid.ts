import type { Context, Next } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { brandSubscriptions } from '../db/schema'
import type { AppEnv } from './auth'

type Sub = typeof brandSubscriptions.$inferSelect

export type AccessResult =
  | { isPaidEffective: true }
  | { isPaidEffective: false; reason: 'trial_expired' | 'paid_expired' | 'no_subscription' | 'free' }

export function computeEffectiveAccess(sub: Sub | undefined, now = Date.now()): AccessResult {
  if (!sub) return { isPaidEffective: false, reason: 'no_subscription' }
  if (sub.isGrandfathered === 1) return { isPaidEffective: true }
  if (sub.status === 'trial' && sub.trialEndsAt && sub.trialEndsAt > now) return { isPaidEffective: true }
  if (sub.tier === 'paid' && sub.status === 'active' && sub.paidUntil && sub.paidUntil > now) {
    return { isPaidEffective: true }
  }
  if (sub.status === 'trial' && sub.trialEndsAt && sub.trialEndsAt <= now) {
    return { isPaidEffective: false, reason: 'trial_expired' }
  }
  if (sub.tier === 'paid' && sub.paidUntil && sub.paidUntil <= now) {
    return { isPaidEffective: false, reason: 'paid_expired' }
  }
  return { isPaidEffective: false, reason: 'free' }
}

export async function loadBrandAccess(brandId: string): Promise<AccessResult & { sub?: Sub }> {
  const sub = await db.query.brandSubscriptions.findFirst({
    where: eq(brandSubscriptions.brandId, brandId),
  })
  const now = Date.now()
  const result = computeEffectiveAccess(sub, now)

  // Lazy flip to 'expired' when we notice it.
  if (!result.isPaidEffective && sub && sub.status !== 'expired'
      && (result.reason === 'trial_expired' || result.reason === 'paid_expired')) {
    await db.update(brandSubscriptions)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(brandSubscriptions.id, sub.id))
  }
  return { ...result, sub }
}

export async function requirePaid(c: Context<AppEnv>, next: Next) {
  const user = c.get('user')
  if (user.role === 'dev') return next()
  const access = await loadBrandAccess(user.brandId)
  if (access.isPaidEffective) return next()
  return c.json({ error: 'subscription_required', reason: (access as any).reason }, 403)
}
