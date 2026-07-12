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
    modelId: model.id,
  }
}

async function createLoan(token: string, modelId: string, amount: number) {
  const res = await app.request('/api/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ modelId, amount, reason: 'x' }),
  })
  return (await res.json()).id as string
}
async function createFine(token: string, modelId: string, amount: number) {
  const res = await app.request('/api/fines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ modelId, amount, reason: 'x' }),
  })
  return (await res.json()).id as string
}

describe('edit loan/fine amount', () => {
  it('monitor can edit a loan amount', async () => {
    const { adminToken, monitorToken, modelId } = await setup()
    const id = await createLoan(adminToken, modelId, 10000)
    const res = await app.request(`/api/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ amount: 15000 }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).amount).toBe(15000)
  })

  it('rejects non-positive loan amount', async () => {
    const { adminToken, modelId } = await setup()
    const id = await createLoan(adminToken, modelId, 10000)
    const res = await app.request(`/api/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 0 }),
    })
    expect(res.status).toBe(400)
  })

  it('admin can edit a fine amount; monitor cannot', async () => {
    const { adminToken, monitorToken, modelId } = await setup()
    const id = await createFine(adminToken, modelId, 5000)
    const denied = await app.request(`/api/fines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ amount: 8000 }),
    })
    expect(denied.status).toBe(403)
    const ok = await app.request(`/api/fines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 8000 }),
    })
    expect(ok.status).toBe(200)
    expect((await ok.json()).amount).toBe(8000)
  })

  it('404 on missing loan', async () => {
    const { adminToken } = await setup()
    const res = await app.request('/api/loans/nope', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 1000 }),
    })
    expect(res.status).toBe(404)
  })
})
