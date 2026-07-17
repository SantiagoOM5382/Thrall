import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { modelsRoutes } from '../../src/routes/models'
import { createTestBrand, createTestUser } from '../helpers'
import fullApp from '../../src/app'
import { db } from '../../src/db/client'
import { profileBoosts } from '../../src/db/schema'
import { newId } from '../../src/lib/ulid'

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

describe('GET /api/models — boost ordering', () => {
  it('lists a boosted model before non-boosted ones and flags isBoosted', async () => {
    const plain = await createTestUser(brandId, { role: 'model', email: `plain-${newId()}@test.com`, name: 'Plain' })
    const boosted = await createTestUser(brandId, { role: 'model', email: `boosted-${newId()}@test.com`, name: 'Boosted' })
    const now = Date.now()
    await db.insert(profileBoosts).values({
      id: newId(), modelId: boosted.id, brandId, purchasedBy: plain.id,
      topServiceId: 'svc_top_perfil_24h', tokensSpent: 50,
      startsAt: now, endsAt: now + 3_600_000, createdAt: now,
    })
    // Expired boost on `plain` must NOT count as active.
    await db.insert(profileBoosts).values({
      id: newId(), modelId: plain.id, brandId, purchasedBy: plain.id,
      topServiceId: 'svc_top_perfil_24h', tokensSpent: 50,
      startsAt: now - 100_000, endsAt: now - 1000, createdAt: now - 100_000,
    })

    const res = await fullApp.request('/api/models')
    const body = await res.json() as any[]
    const boostedEntry = body.find((m) => m.id === boosted.id)
    const plainEntry = body.find((m) => m.id === plain.id)
    expect(boostedEntry.isBoosted).toBe(true)
    expect(plainEntry.isBoosted).toBe(false)
    expect(body.indexOf(boostedEntry)).toBeLessThan(body.indexOf(plainEntry))
  })
})
