import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { purchases } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { newId } from '../../src/lib/ulid'

process.env.WOMPI_PUBLIC_KEY ??= 'pub_test_xxx'
process.env.WOMPI_INTEGRITY_SECRET ??= 'integrity_secret_test'
process.env.SYLVANAS_URL ??= 'https://sylvanas.example.com'

async function post(token: string, body: object) {
  return app.request('/api/brand/purchase-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/brand/purchase-tokens', () => {
  it('charges full price with no active subscription discount', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await post(token, { productId: 'prod_tokens_100' })
    expect(res.status).toBe(200)
    const { checkoutUrl } = await res.json()
    const url = new URL(checkoutUrl)
    expect(url.searchParams.get('amount-in-cents')).toBe('1000000') // 10000 * 100, 0% discount
    const ref = url.searchParams.get('reference')!
    const rows = await db.select().from(purchases).where(eq(purchases.wompiReference, ref))
    expect(rows[0].amountCop).toBe(10000)
    expect(rows[0].productId).toBe('prod_tokens_100')
  })

  it('applies the discount from the latest approved subscription', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const now = Date.now()
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_sub_annual', userId: u.id,
      amountCop: 980000, status: 'APPROVED', wompiReference: 'ref-sub-' + newId(),
      paidAt: now, createdAt: now, updatedAt: now,
    })
    const res = await post(token, { productId: 'prod_tokens_500' })
    const { checkoutUrl } = await res.json()
    const url = new URL(checkoutUrl)
    // 40000 * (1 - 0.60) = 16000
    expect(url.searchParams.get('amount-in-cents')).toBe('1600000')
  })

  it('rejects a SUBSCRIPTION productId with 400', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await post(token, { productId: 'prod_sub_monthly' })
    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.request('/api/brand/purchase-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'prod_tokens_100' }),
    })
    expect(res.status).toBe(401)
  })
})
