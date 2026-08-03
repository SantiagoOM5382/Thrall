import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { users, brandWallets, walletTransactions, topServices, profileBoosts } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { computeBoostExpiry } from '../lib/wallet'

export const modelsRoutes = new Hono<AppEnv>()

class InsufficientTokensError extends Error {}

// Public showcase view: whitelist only fields safe for anonymous consumption.
// Excludes email, brandId, role, isActive, timestamps — those are internal.
function toPublicModel(m: typeof users.$inferSelect, isBoosted: boolean, images: Array<{ id: string; url: string; sortOrder: number }>) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    phone: m.phone,
    telegram: m.telegram,
    isBoosted,
    images,
  }
}

// A model is only shown publicly if it has at least one contact channel —
// otherwise there's no way for someone browsing illidan to reach them.
function hasContact(u: typeof users.$inferSelect): boolean {
  return Boolean(u.phone?.trim()) || Boolean(u.telegram?.trim())
}

modelsRoutes.get('/', async (c) => {
  const now = Date.now()
  const raw = await db.query.users.findMany({
    where: (u, { and, eq, isNull }) =>
      and(eq(u.role, 'model'), eq(u.isActive, 1), isNull(u.deletedAt)),
  })
  const models = raw.filter(hasContact)

  const activeBoosts = await db
    .select({ modelId: profileBoosts.modelId })
    .from(profileBoosts)
    .where(gt(profileBoosts.endsAt, now))
  const boostedIds = new Set(activeBoosts.map((b) => b.modelId))

  const result = await Promise.all(
    models.map(async (m) => {
      const images = await db.query.userImages.findMany({
        where: (img, { and, eq, isNull }) =>
          and(eq(img.userId, m.id), eq(img.isActive, 1), isNull(img.deletedAt)),
        orderBy: (img, { asc }) => [asc(img.sortOrder)],
      })
      return toPublicModel(
        m,
        boostedIds.has(m.id),
        images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })),
      )
    })
  )

  result.sort((a, b) => Number(b.isBoosted) - Number(a.isBoosted))
  return c.json(result)
})

modelsRoutes.get('/:id', async (c) => {
  const now = Date.now()
  const model = await db.query.users.findFirst({
    where: (u, { and, eq, isNull }) =>
      and(eq(u.id, c.req.param('id')), eq(u.role, 'model'), eq(u.isActive, 1), isNull(u.deletedAt)),
  })
  if (!model || !hasContact(model)) return c.json({ error: 'Not found' }, 404)

  const images = await db.query.userImages.findMany({
    where: (img, { and, eq, isNull }) =>
      and(eq(img.userId, model.id), eq(img.isActive, 1), isNull(img.deletedAt)),
    orderBy: (img, { asc }) => [asc(img.sortOrder)],
  })
  const activeBoost = await db
    .select({ id: profileBoosts.id })
    .from(profileBoosts)
    .where(and(eq(profileBoosts.modelId, model.id), gt(profileBoosts.endsAt, now)))
    .limit(1)

  return c.json(toPublicModel(
    model,
    activeBoost.length > 0,
    images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })),
  ))
})

const boostSchema = z.object({ topServiceId: z.string().min(1) })

// Intentionally NOT gated by requirePaid: buying/spending tokens on boosts is
// how FREE brands monetize visibility. Only the subscription unlocks the
// contable side of the panel; boosts are pay-per-use for everyone.
modelsRoutes.post('/:id/boost', authMiddleware, zValidator('json', boostSchema), async (c) => {
  const user = c.get('user')
  const { topServiceId } = c.req.valid('json')
  const modelId = c.req.param('id')

  const model = await db.query.users.findFirst({
    where: and(eq(users.id, modelId), eq(users.role, 'model'), eq(users.brandId, user.brandId)),
  })
  if (!model) return c.json({ error: 'not_found' }, 404)

  const service = await db.query.topServices.findFirst({
    where: and(eq(topServices.id, topServiceId), eq(topServices.isActive, 1)),
  })
  if (!service) return c.json({ error: 'invalid_service' }, 400)

  try {
    const result = await db.transaction(async (tx) => {
      const wallet = await tx.query.brandWallets.findFirst({
        where: eq(brandWallets.brandId, user.brandId),
      })
      const now = Date.now()
      const endsAt = computeBoostExpiry(now, service.durationMinutes)
      const boostId = newId()

      // Atomic guarded decrement: if two boosts race, only one UPDATE will
      // match the `tokens_balance >= cost` predicate (SQLite serializes
      // writes, and the WHERE guard prevents the classic
      // read-compute-write TOCTOU that a naive `SET balance = <js-computed>`
      // pattern permits).
      let newBalance: number
      if (wallet) {
        const upd = await tx.update(brandWallets)
          .set({
            tokensBalance: sql`${brandWallets.tokensBalance} - ${service.tokensCost}`,
            updatedAt: now,
          })
          .where(and(
            eq(brandWallets.id, wallet.id),
            gt(brandWallets.tokensBalance, service.tokensCost - 1),
          ))
          .returning({ tokensBalance: brandWallets.tokensBalance })
        if (upd.length === 0) throw new InsufficientTokensError()
        newBalance = upd[0].tokensBalance
      } else {
        // No wallet row → balance is effectively 0; any positive cost fails.
        if (service.tokensCost > 0) throw new InsufficientTokensError()
        await tx.insert(brandWallets).values({
          id: newId(), brandId: user.brandId, tokensBalance: 0,
          createdAt: now, updatedAt: now,
        })
        newBalance = 0
      }

      await tx.insert(profileBoosts).values({
        id: boostId,
        modelId: model.id,
        brandId: user.brandId,
        purchasedBy: user.sub,
        topServiceId: service.id,
        tokensSpent: service.tokensCost,
        startsAt: now,
        endsAt,
        createdAt: now,
      })

      await tx.insert(walletTransactions).values({
        id: newId(),
        brandId: user.brandId,
        type: 'DEBIT_BOOST',
        amount: service.tokensCost,
        balanceAfter: newBalance,
        profileBoostId: boostId,
        description: `Boost: ${service.displayName}`,
        createdAt: now,
      })

      return { tokensBalance: newBalance, boost: { id: boostId, endsAt } }
    })
    return c.json(result)
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return c.json({ error: 'insufficient_tokens' }, 400)
    }
    throw err
  }
})
