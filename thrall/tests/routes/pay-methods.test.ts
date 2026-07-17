import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { payMethodsRoutes } from '../../src/routes/pay-methods'
import { serializePayMethod } from '../../src/serializers/pay-method'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

// Unit test serializer
describe('serializePayMethod', () => {
  const pm = { id: '1', code: 'NQST', displayName: 'Nequi Santiago', isActive: 1 }

  it('includes displayName for admin', () => {
    const result = serializePayMethod(pm, 'admin')
    expect(result).toHaveProperty('displayName', 'Nequi Santiago')
  })

  it('omits displayName for monitor', () => {
    const result = serializePayMethod(pm, 'monitor')
    expect(result).not.toHaveProperty('displayName')
  })

  it('omits displayName for model', () => {
    const result = serializePayMethod(pm, 'model')
    expect(result).not.toHaveProperty('displayName')
  })
})

// Integration tests
const app = new Hono().basePath('/api')
app.route('/pay-methods', payMethodsRoutes)

let brandId: string
let adminToken: string
let monitorToken: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `admin-pm-${Date.now()}@test.com` })
  adminToken = await tokenFor(admin.id, 'admin', brandId)
  const monitor = await createTestUser(brandId, { role: 'monitor', email: `mon-${Date.now()}@test.com` })
  monitorToken = await tokenFor(monitor.id, 'monitor', brandId)
})

describe('GET /api/pay-methods', () => {
  it('admin sees displayName', async () => {
    await app.request('/api/pay-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'NQST', displayName: 'Nequi Santiago' }),
    })
    const res = await app.request('/api/pay-methods', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const body = await res.json() as any[]
    expect(body[0]).toHaveProperty('displayName')
  })

  it('monitor sees only code, not displayName', async () => {
    // Create a pay method first so the list is non-empty
    await app.request('/api/pay-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `TST${Date.now()}`, displayName: 'Test Method' }),
    })

    const res = await app.request('/api/pay-methods', {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).not.toHaveProperty('displayName')
    expect(body[0]).toHaveProperty('code')
  })
})

describe('brand isolation', () => {
  it('a brand does not see another brand\'s pay methods', async () => {
    await app.request('/api/pay-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ONLYMINE', displayName: 'Solo mío' }),
    })

    const otherBrand = await createTestBrand()
    const otherAdmin = await createTestUser(otherBrand, { role: 'admin', email: `other-pm-${Date.now()}@test.com` })
    const otherToken = await tokenFor(otherAdmin.id, 'admin', otherBrand)

    const res = await app.request('/api/pay-methods', {
      headers: { Authorization: `Bearer ${otherToken}` },
    })
    const body = await res.json() as any[]
    expect(body.some((pm: any) => pm.code === 'ONLYMINE')).toBe(false)
  })

  it('two different brands can each use the same code', async () => {
    const resA = await app.request('/api/pay-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SHARED', displayName: 'Brand A method' }),
    })
    expect(resA.status).toBe(201)

    const otherBrand = await createTestBrand()
    const otherAdmin = await createTestUser(otherBrand, { role: 'admin', email: `other-shared-${Date.now()}@test.com` })
    const otherToken = await tokenFor(otherAdmin.id, 'admin', otherBrand)
    const resB = await app.request('/api/pay-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SHARED', displayName: 'Brand B method' }),
    })
    expect(resB.status).toBe(201)
  })

  it('cannot update another brand\'s pay method (404)', async () => {
    const created = await app.request('/api/pay-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MINE', displayName: 'Mine' }),
    })
    const { id } = await created.json()

    const otherBrand = await createTestBrand()
    const otherAdmin = await createTestUser(otherBrand, { role: 'admin', email: `other-upd-${Date.now()}@test.com` })
    const otherToken = await tokenFor(otherAdmin.id, 'admin', otherBrand)

    const res = await app.request(`/api/pay-methods/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${otherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Hijacked' }),
    })
    expect(res.status).toBe(404)
  })

  it('cannot delete another brand\'s pay method (404)', async () => {
    const created = await app.request('/api/pay-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MINE2', displayName: 'Mine 2' }),
    })
    const { id } = await created.json()

    const otherBrand = await createTestBrand()
    const otherAdmin = await createTestUser(otherBrand, { role: 'admin', email: `other-del-${Date.now()}@test.com` })
    const otherToken = await tokenFor(otherAdmin.id, 'admin', otherBrand)

    const res = await app.request(`/api/pay-methods/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherToken}` },
    })
    expect(res.status).toBe(404)
  })
})
