import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import {
  createTestBrand, createTestUser, tokenFor, createTestPayMethod, createTestService,
} from '../helpers'

describe('model-earnings report', () => {
  it('returns rows and totals for a model in the caller\'s brand', async () => {
    const brandId = await createTestBrand()
    const admin = await createTestUser(brandId, { role: 'admin' })
    const model = await createTestUser(brandId, { role: 'model' })
    const adminToken = await tokenFor(admin.id, 'admin', brandId)
    const payMethodId = await createTestPayMethod(brandId)

    await createTestService(model.id, admin.id, payMethodId, [20000])

    const res = await app.request(
      `/api/reports/model-earnings/${model.id}?from=0&to=${Date.now() + 1000}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toHaveLength(1)
    expect(body.totals.totalModelEarnings).toBe(80000)
  })

  it('rejects a model from another brand with 404', async () => {
    const brandId = await createTestBrand()
    const admin = await createTestUser(brandId, { role: 'admin' })
    const adminToken = await tokenFor(admin.id, 'admin', brandId)

    const otherBrand = await createTestBrand()
    const otherModel = await createTestUser(otherBrand, { role: 'model' })

    const res = await app.request(
      `/api/reports/model-earnings/${otherModel.id}?from=0&to=${Date.now() + 1000}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    )
    expect(res.status).toBe(404)
  })
})
