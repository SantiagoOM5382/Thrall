import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { reportsRoutes } from '../../src/routes/reports'
import { createTestBrand, createTestUser, createTestPayMethod, createTestService, tokenFor } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/reports', reportsRoutes)

let brandId: string
let adminToken: string
let monitorToken: string
let modelToken: string
let modelId: string
let adminId: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `adm-rp-${Date.now()}@t.com` })
  const monitor = await createTestUser(brandId, { role: 'monitor', email: `mon-rp-${Date.now()}@t.com` })
  const model = await createTestUser(brandId, { role: 'model', email: `mod-rp-${Date.now()}@t.com` })
  adminId = admin.id; modelId = model.id
  adminToken = await tokenFor(adminId, 'admin', brandId)
  monitorToken = await tokenFor(monitor.id, 'monitor', brandId)
  modelToken = await tokenFor(model.id, 'model', brandId)
})

describe('GET /api/reports/ranking', () => {
  it('returns ranking for all roles', async () => {
    const pm = await createTestPayMethod(brandId)
    await createTestService(modelId, adminId, pm)

    for (const token of [adminToken, monitorToken, modelToken]) {
      const res = await app.request('/api/reports/ranking', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any[]
      expect(Array.isArray(body)).toBe(true)
    }
  })
})

describe('GET /api/reports/earnings', () => {
  it('returns earnings summary for admin', async () => {
    const pm = await createTestPayMethod(brandId)
    await createTestService(modelId, adminId, pm, [20000])

    const from = Date.now() - 86400000
    const to = Date.now() + 86400000
    const res = await app.request(`/api/reports/earnings?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.totalServices).toBeGreaterThan(0)
    expect(body.companyEarnings).toBeGreaterThan(0)
  })

  it('returns 403 for monitor', async () => {
    const res = await app.request('/api/reports/earnings?from=0&to=9999999999999', {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/reports/daily', () => {
  it('returns daily summary for monitor', async () => {
    const res = await app.request('/api/reports/daily', {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(200)
  })

  it('returns 403 for model', async () => {
    const res = await app.request('/api/reports/daily', {
      headers: { Authorization: `Bearer ${modelToken}` },
    })
    expect(res.status).toBe(403)
  })
})
