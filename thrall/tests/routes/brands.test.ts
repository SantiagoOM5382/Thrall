import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function devToken() {
  const brandId = await createTestBrand()
  const dev = await createTestUser(brandId, { role: 'dev' })
  return await tokenFor(dev.id, 'dev', brandId)
}

describe('brands routes', () => {
  it('dev can create, list, and edit a brand', async () => {
    const token = await devToken()
    const created = await app.request('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Nueva Brand' }),
    })
    expect(created.status).toBe(201)
    const brand = await created.json()
    expect(brand.name).toBe('Nueva Brand')

    const list = await app.request('/api/brands', { headers: { Authorization: `Bearer ${token}` } })
    expect(list.status).toBe(200)
    const brands = await list.json()
    expect(brands.some((b: { id: string }) => b.id === brand.id)).toBe(true)

    const edited = await app.request(`/api/brands/${brand.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Editada', isActive: 0 }),
    })
    expect(edited.status).toBe(200)
    const eb = await edited.json()
    expect(eb.name).toBe('Editada')
    expect(eb.isActive).toBe(0)
  })

  it('non-dev (admin) is forbidden', async () => {
    const brandId = await createTestBrand()
    const admin = await createTestUser(brandId, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brandId)
    const res = await app.request('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(403)
  })

  it('404 editing a missing brand', async () => {
    const token = await devToken()
    const res = await app.request('/api/brands/nope', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Y' }),
    })
    expect(res.status).toBe(404)
  })
})
