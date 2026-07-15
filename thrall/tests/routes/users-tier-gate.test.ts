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

async function put(token: string, id: string, body: object) {
  return app.request(`/api/users/${id}`, {
    method: 'PUT',
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

describe('PUT /api/users/:id tier gating and tenant isolation', () => {
  it('FREE brand admin cannot promote a model to admin via PUT', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'expired', isGrandfathered: 0,
    })
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await put(token, model.id, { role: 'admin' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('subscription_required')
  })

  it('FREE brand admin cannot promote a model to monitor via PUT', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'expired', isGrandfathered: 0,
    })
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await put(token, model.id, { role: 'monitor' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('subscription_required')
  })

  it('PAID brand admin can promote a model to admin via PUT', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await put(token, model.id, { role: 'admin' })
    expect(res.status).toBe(200)
  })

  it('non-dev admin cannot update a user from a different brand', async () => {
    const brandA = await createTestBrand()
    const brandB = await createTestBrand()
    const admin = await createTestUser(brandA, { role: 'admin' })
    const otherUser = await createTestUser(brandB, { role: 'model' })
    const token = await tokenFor(admin.id, 'admin', brandA)
    const res = await put(token, otherUser.id, { name: 'Hacked' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('non-dev cannot escalate any user to dev role via PUT', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await put(token, model.id, { role: 'dev' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })
})
