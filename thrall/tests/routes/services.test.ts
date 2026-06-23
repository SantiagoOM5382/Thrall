import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { servicesRoutes } from '../../src/routes/services'
import { createTestBrand, createTestUser, createTestPayMethod, createTestService, tokenFor } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/services', servicesRoutes)

let brandId: string
let adminId: string
let monitorId: string
let modelId: string
let adminToken: string
let monitorToken: string
let modelToken: string
let payMethodId: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `adm-sv-${Date.now()}@t.com` })
  const monitor = await createTestUser(brandId, { role: 'monitor', email: `mon-sv-${Date.now()}@t.com` })
  const model = await createTestUser(brandId, { role: 'model', email: `mod-sv-${Date.now()}@t.com` })
  adminId = admin.id; monitorId = monitor.id; modelId = model.id
  adminToken = await tokenFor(adminId, 'admin', brandId)
  monitorToken = await tokenFor(monitorId, 'monitor', brandId)
  modelToken = await tokenFor(modelId, 'model', brandId)
  payMethodId = await createTestPayMethod()
})

describe('POST /api/services', () => {
  it('monitor can create a service with extras', async () => {
    const now = Date.now()
    const res = await app.request('/api/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${monitorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId,
        startTime: now - 3600000,
        endTime: now,
        basePrice: 100000,
        payMethodId,
        note: 'Test',
        extras: [{ description: 'Baño', amount: 20000 }],
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBeDefined()
    expect(body.extras).toHaveLength(1)
  })

  it('model cannot create services', async () => {
    const res = await app.request('/api/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${modelToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, startTime: 0, endTime: 1, basePrice: 1000, payMethodId }),
    })
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/services/:id', () => {
  it('monitor can update a service and replace extras', async () => {
    const serviceId = await createTestService(modelId, monitorId, payMethodId, [10000])
    const now = Date.now()
    const res = await app.request(`/api/services/${serviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${monitorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basePrice: 150000,
        extras: [{ description: 'New Extra', amount: 25000 }],
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.basePrice).toBe(150000)
    expect(body.extras).toHaveLength(1)
    expect(body.extras[0].amount).toBe(25000)
  })

  it('returns 404 for non-existent service', async () => {
    const res = await app.request('/api/services/non-existent-id', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ basePrice: 100000 }),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/services/:id', () => {
  it('monitor can soft delete a service', async () => {
    const serviceId = await createTestService(modelId, monitorId, payMethodId)
    const res = await app.request(`/api/services/${serviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/services/:id visibility', () => {
  it('admin sees deleted service in GET, monitor does not', async () => {
    const serviceId = await createTestService(modelId, adminId, payMethodId)
    // Delete it
    await app.request(`/api/services/${serviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    // Admin sees it
    const adminRes = await app.request('/api/services', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const adminBody = await adminRes.json() as any[]
    expect(adminBody.some((s: any) => s.id === serviceId)).toBe(true)
    // Monitor does not (today filter + deletedAt IS NULL)
    const monitorRes = await app.request('/api/services', {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    const monitorBody = await monitorRes.json() as any[]
    expect(monitorBody.some((s: any) => s.id === serviceId)).toBe(false)
  })
})

describe('GET /api/services', () => {
  it('model only sees own services', async () => {
    const model2 = await createTestUser(brandId, { role: 'model', email: `mod2-${Date.now()}@t.com` })
    await createTestService(modelId, adminId, payMethodId)
    await createTestService(model2.id, adminId, payMethodId)

    const res = await app.request('/api/services', {
      headers: { Authorization: `Bearer ${modelToken}` },
    })
    const body = await res.json() as any[]
    expect(body.every((s: any) => s.modelId === modelId)).toBe(true)
  })
})
