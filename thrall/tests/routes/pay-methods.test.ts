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

  it('monitor sees only code', async () => {
    const res = await app.request('/api/pay-methods', {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    const body = await res.json() as any[]
    if (body.length > 0) {
      expect(body[0]).not.toHaveProperty('displayName')
    }
  })
})
