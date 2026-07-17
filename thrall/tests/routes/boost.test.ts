import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { brandWallets, profileBoosts, walletTransactions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { newId } from '../../src/lib/ulid'

async function post(token: string, modelId: string, body: object) {
  return app.request(`/api/models/${modelId}/boost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/models/:id/boost', () => {
  it('debits the wallet and creates a boost', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model', email: `m-${newId()}@test.com` })
    const token = await tokenFor(admin.id, 'admin', brand)
    const now = Date.now()
    await db.insert(brandWallets).values({ id: newId(), brandId: brand, tokensBalance: 100, createdAt: now, updatedAt: now })

    const res = await post(token, model.id, { topServiceId: 'svc_top_perfil_24h' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tokensBalance).toBe(50)
    expect(body.boost.endsAt).toBeGreaterThan(now)

    const wallet = await db.query.brandWallets.findFirst({ where: eq(brandWallets.brandId, brand) })
    expect(wallet?.tokensBalance).toBe(50)

    const boosts = await db.select().from(profileBoosts).where(eq(profileBoosts.modelId, model.id))
    expect(boosts).toHaveLength(1)
    expect(boosts[0].tokensSpent).toBe(50)

    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.brandId, brand))
    expect(txs).toHaveLength(1)
    expect(txs[0].type).toBe('DEBIT_BOOST')
  })

  it('rejects with 400 when the wallet balance is insufficient', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model', email: `m-${newId()}@test.com` })
    const token = await tokenFor(admin.id, 'admin', brand)
    // No wallet row at all -> balance 0
    const res = await post(token, model.id, { topServiceId: 'svc_top_perfil_24h' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('insufficient_tokens')
  })

  it('rejects with 404 when the model belongs to another brand', async () => {
    const brandA = await createTestBrand()
    const brandB = await createTestBrand()
    const admin = await createTestUser(brandA, { role: 'admin' })
    const otherModel = await createTestUser(brandB, { role: 'model', email: `m-${newId()}@test.com` })
    const token = await tokenFor(admin.id, 'admin', brandA)
    const res = await post(token, otherModel.id, { topServiceId: 'svc_top_perfil_24h' })
    expect(res.status).toBe(404)
  })

  it('rejects with 400 for an unknown topServiceId', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model', email: `m-${newId()}@test.com` })
    const token = await tokenFor(admin.id, 'admin', brand)
    const now = Date.now()
    await db.insert(brandWallets).values({ id: newId(), brandId: brand, tokensBalance: 999, createdAt: now, updatedAt: now })
    const res = await post(token, model.id, { topServiceId: 'does-not-exist' })
    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated request with 401', async () => {
    const brand = await createTestBrand()
    const model = await createTestUser(brand, { role: 'model', email: `m-${newId()}@test.com` })
    const res = await app.request(`/api/models/${model.id}/boost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topServiceId: 'svc_top_perfil_24h' }),
    })
    expect(res.status).toBe(401)
  })
})
