import { describe, it, expect, beforeEach } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function setup() {
  const brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin' })
  const monitor = await createTestUser(brandId, { role: 'monitor' })
  const model = await createTestUser(brandId, { role: 'model' })
  return {
    brandId,
    adminToken: await tokenFor(admin.id, 'admin', brandId),
    monitorToken: await tokenFor(monitor.id, 'monitor', brandId),
    modelToken: await tokenFor(model.id, 'model', brandId),
    modelId: model.id,
  }
}

describe('fines routes', () => {
  it('monitor can create a fine', async () => {
    const { monitorToken, modelId } = await setup()
    const res = await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 5000, reason: 'Llegó tarde' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.amount).toBe(5000)
    expect(body.modelId).toBe(modelId)
  })

  it('rejects non-positive amount', async () => {
    const { monitorToken, modelId } = await setup()
    const res = await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 0, reason: 'x' }),
    })
    expect(res.status).toBe(400)
  })

  it('monitor CANNOT delete a fine, admin CAN', async () => {
    const { adminToken, monitorToken, modelId } = await setup()
    const created = await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 3000, reason: 'x' }),
    })
    const { id } = await created.json()

    const denied = await app.request(`/api/fines/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(denied.status).toBe(403)

    const ok = await app.request(`/api/fines/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(ok.status).toBe(200)
  })

  it('model sees only own fines from today', async () => {
    const { adminToken, modelToken, modelId } = await setup()
    await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 1000, reason: 'x' }),
    })
    const res = await app.request('/api/fines', {
      headers: { Authorization: `Bearer ${modelToken}` },
    })
    expect(res.status).toBe(200)
    const list = await res.json()
    expect(list).toHaveLength(1)
    expect(list[0].modelId).toBe(modelId)
  })

  it('delete returns 404 for missing fine', async () => {
    const { adminToken } = await setup()
    const res = await app.request('/api/fines/nonexistent', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(404)
  })
})
