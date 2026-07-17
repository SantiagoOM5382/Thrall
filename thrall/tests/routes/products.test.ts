import { describe, it, expect } from 'vitest'
import app from '../../src/app'

describe('GET /api/products', () => {
  it('lists active SUBSCRIPTION products by default', async () => {
    const res = await app.request('/api/products')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    const codes = body.map((p: { code: string }) => p.code).sort()
    expect(codes).toEqual(['sub_annual', 'sub_monthly', 'sub_semester'])
    for (const p of body) {
      expect(p.type).toBe('SUBSCRIPTION')
      expect(p.priceCop).toBeGreaterThan(0)
      expect(typeof p.displayName).toBe('string')
      expect(typeof p.durationDays).toBe('number')
    }
  })

  it('respects ?type filter', async () => {
    const res = await app.request('/api/products?type=TOKEN_PACK')
    expect(res.status).toBe(200)
    const body = await res.json()
    const codes = body.map((p: { code: string }) => p.code).sort()
    expect(codes).toEqual(['tokens_100', 'tokens_1500', 'tokens_500'])
    for (const p of body) {
      expect(p.type).toBe('TOKEN_PACK')
      expect(p.tokensGranted).toBeGreaterThan(0)
    }
  })
})
