import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import {
  createTestBrand, createTestUser, tokenFor, createTestPayMethod, createTestService,
} from '../helpers'

describe('brand-earnings report', () => {
  it('sums earnings per brand for a dev', async () => {
    const brandA = await createTestBrand()
    const adminA = await createTestUser(brandA, { role: 'admin' })
    const modelA = await createTestUser(brandA, { role: 'model' })
    const pm = await createTestPayMethod(brandA)
    // one service basePrice 100000, extras [20000] → company 40000, modelTotal 80000
    await createTestService(modelA.id, adminA.id, pm, [20000])

    const platform = await createTestBrand()
    const dev = await createTestUser(platform, { role: 'dev' })
    const token = await tokenFor(dev.id, 'dev', platform)

    const res = await app.request(`/api/reports/brand-earnings?from=0&to=${Date.now() + 1000}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const rowA = body.rows.find((r: { brandId: string }) => r.brandId === brandA)
    expect(rowA.totalServices).toBe(1)
    expect(rowA.totalBase).toBe(100000)
    expect(rowA.companyEarnings).toBe(40000)
    expect(rowA.modelTotalEarnings).toBe(80000)
    expect(body.totals.companyEarnings).toBeGreaterThanOrEqual(40000)
  })

  it('is dev-only', async () => {
    const brandId = await createTestBrand()
    const admin = await createTestUser(brandId, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brandId)
    const res = await app.request('/api/reports/brand-earnings', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(403)
  })
})
