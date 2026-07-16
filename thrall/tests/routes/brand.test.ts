import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

describe('GET /api/brand/subscription', () => {
  it('returns state with daysLeft for trial brand', async () => {
    const trialEndsAt = Date.now() + 5 * 86400 * 1000
    const brand = await createTestBrand({
      tier: 'free', status: 'trial', trialEndsAt, isGrandfathered: 0,
    })
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await app.request('/api/brand/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tier).toBe('free')
    expect(body.status).toBe('trial')
    expect(body.isPaidEffective).toBe(true)
    expect(body.daysLeft).toBeGreaterThanOrEqual(4)
    expect(body.daysLeft).toBeLessThanOrEqual(5)
  })

  it('returns isPaidEffective=true for grandfathered brand with null daysLeft', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await app.request('/api/brand/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    expect(body.isPaidEffective).toBe(true)
    expect(body.daysLeft).toBeNull()
  })
})
