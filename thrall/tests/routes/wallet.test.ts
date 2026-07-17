import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { purchases, brandWallets, walletTransactions } from '../../src/db/schema'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { newId } from '../../src/lib/ulid'

async function get(path: string, token: string) {
  return app.request(path, { headers: { Authorization: `Bearer ${token}` } })
}

describe('GET /api/brand/wallet', () => {
  it('returns 0 balance and 0% discount for a brand with no purchases', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get('/api/brand/wallet', token)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ tokensBalance: 0, tokenDiscountPercent: 0 })
  })

  it('reflects the balance and resolves discount from the latest approved subscription', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const now = Date.now()
    await db.insert(brandWallets).values({ id: newId(), brandId: brand, tokensBalance: 250, createdAt: now, updatedAt: now })
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_sub_semester', userId: u.id,
      amountCop: 500000, status: 'APPROVED', wompiReference: 'ref-wallet-' + newId(),
      paidAt: now, createdAt: now, updatedAt: now,
    })
    const res = await get('/api/brand/wallet', token)
    const body = await res.json()
    expect(body.tokensBalance).toBe(250)
    expect(body.tokenDiscountPercent).toBe(35)
  })
})

describe('GET /api/brand/wallet/transactions', () => {
  it('returns transactions newest first', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const now = Date.now()
    await db.insert(walletTransactions).values({
      id: newId(), brandId: brand, type: 'CREDIT_PURCHASE', amount: 100,
      balanceAfter: 100, description: 'old', createdAt: now - 1000,
    })
    await db.insert(walletTransactions).values({
      id: newId(), brandId: brand, type: 'DEBIT_BOOST', amount: 50,
      balanceAfter: 50, description: 'new', createdAt: now,
    })
    const res = await get('/api/brand/wallet/transactions', token)
    const body = await res.json()
    expect(body.transactions).toHaveLength(2)
    expect(body.transactions[0].description).toBe('new')
    expect(body.transactions[1].description).toBe('old')
  })
})
