import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function get(path: string, token: string) {
  return app.request(path, { headers: { Authorization: `Bearer ${token}` } })
}

describe('requirePaid middleware', () => {
  it('allows PAID grandfathered brand', async () => {
    const brand = await createTestBrand({ tier: 'paid', status: 'active', isGrandfathered: 1 })
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get('/api/services', token)
    expect(res.status).toBe(200)
  })

  it('allows brand in active trial', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'trial', isGrandfathered: 0,
      trialEndsAt: Date.now() + 86400 * 1000,
    })
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get('/api/services', token)
    expect(res.status).toBe(200)
  })

  it('denies FREE brand with expired trial', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'trial', isGrandfathered: 0,
      trialEndsAt: Date.now() - 1000,
    })
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get('/api/services', token)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('subscription_required')
    expect(body.reason).toBe('trial_expired')
  })

  it('dev role bypasses gate', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'dev' })
    const token = await tokenFor(u.id, 'dev', brand)
    const res = await get('/api/services', token)
    expect(res.status).toBe(200)
  })
})
