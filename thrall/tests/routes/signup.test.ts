import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db/client'
import { brands, users, brandSubscriptions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'

describe('POST /api/auth/signup', () => {
  it('creates brand + admin + trial subscription and returns a token', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: 'Acme Models', adminName: 'Jane', email: 'jane@acme.co', password: 'password123',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBeTypeOf('string')
    expect(body.user.role).toBe('admin')

    const user = await db.query.users.findFirst({ where: eq(users.email, 'jane@acme.co') })
    expect(user).toBeTruthy()
    const brand = await db.query.brands.findFirst({ where: eq(brands.id, user!.brandId) })
    expect(brand?.name).toBe('Acme Models')
    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand!.id) })
    expect(sub?.tier).toBe('free')
    expect(sub?.status).toBe('trial')
    expect(sub?.trialEndsAt).toBeGreaterThan(Date.now())
    // 10 days ± 1 minute
    expect(Math.abs(sub!.trialEndsAt! - (Date.now() + 10 * 86400 * 1000))).toBeLessThan(60_000)
  })

  it('rejects duplicate email with 409', async () => {
    await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'B1', adminName: 'X', email: 'dup@x.co', password: 'password123' }),
    })
    const res = await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'B2', adminName: 'Y', email: 'dup@x.co', password: 'password123' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects duplicate brand name case-insensitively with 409', async () => {
    await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'Unique Brand', adminName: 'X', email: 'a@x.co', password: 'password123' }),
    })
    const res = await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'unique brand', adminName: 'Y', email: 'b@x.co', password: 'password123' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects short password with 400', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'B', adminName: 'X', email: 'p@x.co', password: 'short' }),
    })
    expect(res.status).toBe(400)
  })
})
