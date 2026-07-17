import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../db/client'
import { users, brandWallets, walletTransactions, topServices, profileBoosts } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { computeBoostExpiry } from '../lib/wallet'

export const modelsRoutes = new Hono<AppEnv>()

class InsufficientTokensError extends Error {}

modelsRoutes.get('/', async (c) => {
  const now = Date.now()
  const models = await db.query.users.findMany({
    where: (u, { and, eq, isNull }) =>
      and(eq(u.role, 'model'), eq(u.isActive, 1), isNull(u.deletedAt)),
  })

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
      const { password: _, ...model } = m
      return {
        ...model,
        isBoosted: boostedIds.has(m.id),
        images: images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })),
      }
    })
  )

  result.sort((a, b) => Number(b.isBoosted) - Number(a.isBoosted))
  return c.json(result)
})

modelsRoutes.get('/:id', async (c) => {
  const model = await db.query.users.findFirst({
    where: (u, { and, eq, isNull }) =>
      and(eq(u.id, c.req.param('id')), eq(u.role, 'model'), eq(u.isActive, 1), isNull(u.deletedAt)),
  })
  if (!model) return c.json({ error: 'Not found' }, 404)

  const images = await db.query.userImages.findMany({
    where: (img, { and, eq, isNull }) =>
      and(eq(img.userId, model.id), eq(img.isActive, 1), isNull(img.deletedAt)),
    orderBy: (img, { asc }) => [asc(img.sortOrder)],
  })

  const { password: _, ...rest } = model
  return c.json({ ...rest, images: images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })) })
})

const boostSchema = z.object({ topServiceId: z.string().min(1) })

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
      const currentBalance = wallet?.tokensBalance ?? 0
      if (currentBalance < service.tokensCost) {
        throw new InsufficientTokensError()
      }

      const now = Date.now()
      const endsAt = computeBoostExpiry(now, service.durationHours)
      const newBalance = currentBalance - service.tokensCost
      const boostId = newId()

      if (wallet) {
        await tx.update(brandWallets)
          .set({ tokensBalance: newBalance, updatedAt: now })
          .where(eq(brandWallets.id, wallet.id))
      } else {
        await tx.insert(brandWallets).values({
          id: newId(), brandId: user.brandId, tokensBalance: newBalance,
          createdAt: now, updatedAt: now,
        })
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
