import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { purchases } from '../../src/db/schema'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { newId } from '../../src/lib/ulid'

async function get(token: string) {
  return app.request('/api/brand/purchases/latest', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

describe('GET /api/brand/purchases/latest', () => {
  it('returns null when brand has no purchases', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get(token)
    const body = await res.json()
    expect(body).toEqual({ latest: null })
  })

  it('returns the newest purchase for the brand', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const now = Date.now()
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_sub_monthly', userId: u.id,
      amountCop: 85000, status: 'PENDING', wompiReference: 'ref-old',
      createdAt: now - 5000, updatedAt: now - 5000,
    })
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_sub_monthly', userId: u.id,
      amountCop: 85000, status: 'APPROVED', wompiReference: 'ref-new',
      paidAt: now, createdAt: now, updatedAt: now,
    })
    const res = await get(token)
    const body = await res.json()
    expect(body.latest.wompiReference).toBe('ref-new')
    expect(body.latest.status).toBe('APPROVED')
    expect(body.latest.productCode).toBe('sub_monthly')
    expect(body.latest.amountCop).toBe(85000)
  })
})
