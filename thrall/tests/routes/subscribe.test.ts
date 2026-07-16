import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { purchases } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

process.env.WOMPI_PUBLIC_KEY ??= 'pub_test_xxx'
process.env.WOMPI_INTEGRITY_SECRET ??= 'integrity_secret_test'
process.env.SYLVANAS_URL ??= 'https://sylvanas.example.com'

async function post(token: string, body: object) {
  return app.request('/api/brand/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/brand/subscribe', () => {
  it('returns a Wompi checkout URL and inserts a PENDING purchase', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await post(token, { productId: 'prod_sub_monthly' })
    expect(res.status).toBe(200)
    const { checkoutUrl } = await res.json()
    const url = new URL(checkoutUrl)
    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/')
    expect(url.searchParams.get('amount-in-cents')).toBe('8500000')
    const ref = url.searchParams.get('reference')!
    expect(ref.length).toBeGreaterThan(0)
    expect(url.searchParams.get('signature:integrity')?.length).toBe(64)
    expect(url.searchParams.get('redirect-url'))
      .toBe('https://sylvanas.example.com/dashboard/subscribe/success')

    const rows = await db.select().from(purchases).where(eq(purchases.wompiReference, ref))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('PENDING')
    expect(rows[0].amountCop).toBe(85000)
    expect(rows[0].brandId).toBe(brand)
    expect(rows[0].userId).toBe(u.id)
    expect(rows[0].productId).toBe('prod_sub_monthly')
  })

  it('rejects unknown productId with 400', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await post(token, { productId: 'does_not_exist' })
    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.request('/api/brand/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'prod_sub_monthly' }),
    })
    expect(res.status).toBe(401)
  })
})
