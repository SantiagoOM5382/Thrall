// tests/routes/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authRoutes } from '../../src/routes/auth'
import { createTestBrand, createTestUser } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/auth', authRoutes)

let brandId: string
let userId: string
let userEmail: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const user = await createTestUser(brandId, { role: 'admin', email: `admin-${Date.now()}@test.com` })
  userId = user.id
  userEmail = user.email
})

describe('POST /api/auth/login', () => {
  it('returns token on valid credentials', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'password123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.token).toBeDefined()
    expect(body.user.role).toBe('admin')
  })

  it('returns 401 on wrong password', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 on unknown email', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for inactive user', async () => {
    // Create an inactive user
    const inactive = await createTestUser(brandId, {
      role: 'model',
      email: `inactive-${Date.now()}@test.com`,
    })
    // Mark as inactive directly via db
    const { db } = await import('../../src/db/client')
    const { users } = await import('../../src/db/schema')
    const { eq } = await import('drizzle-orm')
    await db.update(users).set({ isActive: 0 }).where(eq(users.id, inactive.id))

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inactive.email, password: 'password123' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('returns user data with valid token', async () => {
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'password123' }),
    })
    const { token } = await loginRes.json() as any

    const res = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBe(userId)
  })

  it('returns 401 without token', async () => {
    const res = await app.request('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
