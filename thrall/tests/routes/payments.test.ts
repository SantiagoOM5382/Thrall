import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor, createTestPayMethod } from '../helpers'

async function setup() {
  const brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin' })
  const monitor = await createTestUser(brandId, { role: 'monitor' })
  const model = await createTestUser(brandId, { role: 'model' })
  return {
    adminToken: await tokenFor(admin.id, 'admin', brandId),
    monitorToken: await tokenFor(monitor.id, 'monitor', brandId),
    modelId: model.id,
    payMethodId: await createTestPayMethod(),
  }
}

describe('payments routes', () => {
  it('admin can create a payment', async () => {
    const { adminToken, modelId, payMethodId } = await setup()
    const res = await app.request('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 120000, payMethodId }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).amount).toBe(120000)
  })

  it('monitor CANNOT create a payment', async () => {
    const { monitorToken, modelId, payMethodId } = await setup()
    const res = await app.request('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 1000, payMethodId }),
    })
    expect(res.status).toBe(403)
  })

  it('admin lists payments for a model', async () => {
    const { adminToken, modelId, payMethodId } = await setup()
    await app.request('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 5000, payMethodId }),
    })
    const res = await app.request(`/api/payments?modelId=${modelId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    expect((await res.json())).toHaveLength(1)
  })
})
