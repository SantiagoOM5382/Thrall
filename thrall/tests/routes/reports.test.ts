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
  it('returns ranking for admin and monitor', async () => {
    const pm = await createTestPayMethod(brandId)
    await createTestService(modelId, adminId, pm)

    for (const token of [adminToken, monitorToken]) {
      const res = await app.request('/api/reports/ranking', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any[]
      expect(Array.isArray(body)).toBe(true)
    }
  })

  it('returns 403 for model role', async () => {
    const res = await app.request('/api/reports/ranking', {
      headers: { Authorization: `Bearer ${modelToken}` },
    })
    expect(res.status).toBe(403)
  })

  it('does not include another brand\'s models', async () => {
    const otherBrand = await createTestBrand()
    const otherAdmin = await createTestUser(otherBrand, { role: 'admin' })
    const otherModel = await createTestUser(otherBrand, { role: 'model' })
    const otherPm = await createTestPayMethod(otherBrand)
    await createTestService(otherModel.id, otherAdmin.id, otherPm)

    const res = await app.request('/api/reports/ranking', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const body = await res.json() as any[]
    expect(body.some((r) => r.modelId === otherModel.id)).toBe(false)
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

  it('excludes another brand\'s services from the totals', async () => {
    const pm = await createTestPayMethod(brandId)
    await createTestService(modelId, adminId, pm, [20000])

    const otherBrand = await createTestBrand()
    const otherAdmin = await createTestUser(otherBrand, { role: 'admin' })
    const otherModel = await createTestUser(otherBrand, { role: 'model' })
    const otherPm = await createTestPayMethod(otherBrand)
    // Much larger service on the other brand — if isolation were broken this
    // would dominate the totals we assert on below.
    await createTestService(otherModel.id, otherAdmin.id, otherPm, [500000])

    const from = Date.now() - 86400000
    const to = Date.now() + 86400000
    const res = await app.request(`/api/reports/earnings?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const body = await res.json() as any
    expect(body.totalServices).toBe(1)
    expect(body.companyEarnings).toBe(40000) // 40% of the 100000 base from createTestService
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

  it('excludes another brand\'s services from today\'s totals', async () => {
    const pm = await createTestPayMethod(brandId)
    await createTestService(modelId, adminId, pm)

    const otherBrand = await createTestBrand()
    const otherAdmin = await createTestUser(otherBrand, { role: 'admin' })
    const otherModel = await createTestUser(otherBrand, { role: 'model' })
    const otherPm = await createTestPayMethod(otherBrand)
    await createTestService(otherModel.id, otherAdmin.id, otherPm)

    const res = await app.request('/api/reports/daily', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const body = await res.json() as any
    expect(body.totalServices).toBe(1)
  })
})
