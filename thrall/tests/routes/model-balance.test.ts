import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import {
  createTestBrand, createTestUser, tokenFor, createTestPayMethod, createTestService,
} from '../helpers'

describe('model-balance report', () => {
  it('computes balance = earnings - fines - loans - payments', async () => {
    const brandId = await createTestBrand()
    const admin = await createTestUser(brandId, { role: 'admin' })
    const model = await createTestUser(brandId, { role: 'model' })
    const adminToken = await tokenFor(admin.id, 'admin', brandId)
    const payMethodId = await createTestPayMethod(brandId)

    // One service: basePrice 100000, extras [20000] → modelTotal = 60000 + 20000 = 80000
    await createTestService(model.id, admin.id, payMethodId, [20000])

    // Fine 5000, loan 30000, payment 10000
    await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId: model.id, amount: 5000, reason: 'x' }),
    })
    await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId: model.id, amount: 30000, reason: 'x' }),
    })
    await app.request('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId: model.id, amount: 10000, payMethodId }),
    })

    const res = await app.request(`/api/reports/model-balance/${model.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const b = await res.json()
    expect(b.totalEarnings).toBe(80000)
    expect(b.totalFines).toBe(5000)
    expect(b.totalLoans).toBe(30000)
    expect(b.totalPayments).toBe(10000)
    expect(b.balance).toBe(80000 - 5000 - 30000 - 10000) // 35000
  })

  it('is admin-only', async () => {
    const brandId = await createTestBrand()
    const monitor = await createTestUser(brandId, { role: 'monitor' })
    const model = await createTestUser(brandId, { role: 'model' })
    const monitorToken = await tokenFor(monitor.id, 'monitor', brandId)
    const res = await app.request(`/api/reports/model-balance/${model.id}`, {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(403)
  })
})
