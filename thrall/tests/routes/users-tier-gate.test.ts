import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function post(token: string, body: object) {
  return app.request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/users tier gating', () => {
  it('FREE brand admin can create a model', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'expired', isGrandfathered: 0,
    })
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await post(token, {
      name: 'M', email: `m-${Date.now()}@x.co`, password: 'password123', role: 'model',
    })
    expect(res.status).toBe(201)
  })

  it('FREE brand admin cannot create another admin', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'expired', isGrandfathered: 0,
    })
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await post(token, {
      name: 'A2', email: `a-${Date.now()}@x.co`, password: 'password123', role: 'admin',
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('subscription_required')
  })

  it('FREE brand admin cannot create a monitor', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'expired', isGrandfathered: 0,
    })
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await post(token, {
      name: 'Mo', email: `mo-${Date.now()}@x.co`, password: 'password123', role: 'monitor',
    })
    expect(res.status).toBe(403)
  })

  it('PAID brand admin can create admins and monitors', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await post(token, {
      name: 'A2', email: `pa-${Date.now()}@x.co`, password: 'password123', role: 'admin',
    })
    expect(res.status).toBe(201)
  })
})
