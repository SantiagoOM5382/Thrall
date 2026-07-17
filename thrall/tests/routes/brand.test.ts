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

describe('GET /api/brand/models', () => {
  it('only returns models belonging to the caller\'s brand', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const ownModel = await createTestUser(brand, { role: 'model', name: 'Mío', email: `own-${Date.now()}@t.com` })

    const otherBrand = await createTestBrand()
    await createTestUser(otherBrand, { role: 'model', name: 'Ajeno', email: `other-${Date.now()}@t.com` })

    const res = await app.request('/api/brand/models', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(ownModel.id)
    expect(body[0].password).toBeUndefined()
  })

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.request('/api/brand/models')
    expect(res.status).toBe(401)
  })
})
