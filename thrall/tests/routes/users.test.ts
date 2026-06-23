import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { usersRoutes } from '../../src/routes/users'
import { authMiddleware } from '../../src/middleware/auth'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/users', usersRoutes)

let brandId: string
let adminToken: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `admin-${Date.now()}@test.com` })
  adminToken = await tokenFor(admin.id, 'admin', brandId)
})

describe('GET /api/users', () => {
  it('returns users list for admin', async () => {
    const res = await app.request('/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.every((u: any) => u.password === undefined)).toBe(true)
  })

  it('returns 401 without token', async () => {
    const res = await app.request('/api/users')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/users', () => {
  it('creates a new user', async () => {
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Nueva Modelo',
        email: `model-${Date.now()}@test.com`,
        password: 'pass1234',
        role: 'model',
        brandId,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBeDefined()
    expect(body.password).toBeUndefined()
  })
})

describe('DELETE /api/users/:id', () => {
  it('soft deletes a user', async () => {
    const user = await createTestUser(brandId, { role: 'model', email: `del-${Date.now()}@test.com` })
    const res = await app.request(`/api/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
  })
})
