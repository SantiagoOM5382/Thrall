import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

describe('users route — dev', () => {
  it('dev creates an admin in a chosen brand', async () => {
    const platformBrand = await createTestBrand()
    const targetBrand = await createTestBrand()
    const dev = await createTestUser(platformBrand, { role: 'dev' })
    const token = await tokenFor(dev.id, 'dev', platformBrand)

    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Admin Nuevo', email: `a-${Date.now()}@t.co`, password: 'secret123',
        role: 'admin', brandId: targetBrand,
      }),
    })
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created.brandId).toBe(targetBrand)
    expect(created.role).toBe('admin')
  })

  it('dev GET /users returns users across brands; ?brandId filters', async () => {
    const platformBrand = await createTestBrand()
    const brandA = await createTestBrand()
    const dev = await createTestUser(platformBrand, { role: 'dev' })
    await createTestUser(brandA, { role: 'admin' })
    const token = await tokenFor(dev.id, 'dev', platformBrand)

    const all = await app.request('/api/users', { headers: { Authorization: `Bearer ${token}` } })
    const allBody = await all.json()
    expect(allBody.length).toBeGreaterThanOrEqual(2)

    const filtered = await app.request(`/api/users?brandId=${brandA}`, { headers: { Authorization: `Bearer ${token}` } })
    const fBody = await filtered.json()
    expect(fBody.every((u: { brandId: string }) => u.brandId === brandA)).toBe(true)
  })
})
