import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { modelsRoutes } from '../../src/routes/models'
import { createTestBrand, createTestUser } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/models', modelsRoutes)

let brandId: string

beforeEach(async () => {
  brandId = await createTestBrand()
})

describe('GET /api/models', () => {
  it('returns public list without auth', async () => {
    await createTestUser(brandId, { role: 'model', email: `m-${Date.now()}@test.com`, name: 'Ana' })
    const res = await app.request('/api/models')
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.every((u: any) => u.password === undefined)).toBe(true)
  })
})

describe('GET /api/models/:id', () => {
  it('returns 404 for non-existent model', async () => {
    const res = await app.request('/api/models/nonexistent-id')
    expect(res.status).toBe(404)
  })

  it('returns model profile with images', async () => {
    const { id } = await createTestUser(brandId, { role: 'model', email: `m2-${Date.now()}@test.com`, name: 'Maria' })
    const res = await app.request(`/api/models/${id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBe(id)
    expect(body.password).toBeUndefined()
    expect(Array.isArray(body.images)).toBe(true)
  })
})
