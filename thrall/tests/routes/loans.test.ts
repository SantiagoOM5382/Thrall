import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function setup() {
  const brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin' })
  const monitor = await createTestUser(brandId, { role: 'monitor' })
  const model = await createTestUser(brandId, { role: 'model' })
  return {
    adminToken: await tokenFor(admin.id, 'admin', brandId),
    monitorToken: await tokenFor(monitor.id, 'monitor', brandId),
    modelToken: await tokenFor(model.id, 'model', brandId),
    modelId: model.id,
  }
}

describe('loans routes', () => {
  it('monitor can create a loan', async () => {
    const { monitorToken, modelId } = await setup()
    const res = await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 50000, reason: 'Adelanto' }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).amount).toBe(50000)
  })

  it('monitor CAN delete a loan (with record)', async () => {
    const { monitorToken, modelId } = await setup()
    const created = await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 20000, reason: 'x' }),
    })
    const { id } = await created.json()
    const del = await app.request(`/api/loans/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(del.status).toBe(200)
  })

  it('model sees only own loans from today', async () => {
    const { adminToken, modelToken, modelId } = await setup()
    await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 10000, reason: 'x' }),
    })
    const res = await app.request('/api/loans', { headers: { Authorization: `Bearer ${modelToken}` } })
    expect((await res.json())).toHaveLength(1)
  })

  it('rejects creating a loan for another brand\'s model with 404', async () => {
    const { adminToken } = await setup()
    const other = await setup()
    const res = await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId: other.modelId, amount: 1000, reason: 'x' }),
    })
    expect(res.status).toBe(404)
  })

  it('admin does not see another brand\'s loans', async () => {
    const { adminToken, modelId } = await setup()
    await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 1000, reason: 'x' }),
    })
    const other = await setup()
    const res = await app.request('/api/loans', {
      headers: { Authorization: `Bearer ${other.adminToken}` },
    })
    expect(await res.json()).toHaveLength(0)
  })

  it('rejects deleting another brand\'s loan with 404', async () => {
    const { monitorToken, modelId } = await setup()
    const created = await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 1000, reason: 'x' }),
    })
    const { id } = await created.json()
    const other = await setup()
    const res = await app.request(`/api/loans/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${other.monitorToken}` },
    })
    expect(res.status).toBe(404)
  })
})
