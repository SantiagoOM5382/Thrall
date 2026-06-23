import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { imagesRoutes } from '../../src/routes/images'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { db } from '../../src/db/client'
import { userImages } from '../../src/db/schema'
import { newId } from '../../src/lib/ulid'

// NOTE: The POST /images/users/:id endpoint is NOT tested here because it requires
// a real Vercel Blob service (calls put() from @vercel/blob). In this test environment,
// BLOB_READ_WRITE_TOKEN is set to 'test-blob-token' (fake) and the upload would fail.
// To test the upload endpoint, a real Vercel Blob token or a mock server is needed.

const app = new Hono().basePath('/api')
app.route('/images', imagesRoutes)

let brandId: string
let adminId: string
let adminToken: string
let modelId: string
let modelToken: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `admin-${Date.now()}@test.com` })
  adminId = admin.id
  adminToken = await tokenFor(adminId, 'admin', brandId)

  const model = await createTestUser(brandId, { role: 'model', email: `model-${Date.now()}@test.com` })
  modelId = model.id
  modelToken = await tokenFor(modelId, 'model', brandId)
})

async function createTestImage(userId: string) {
  const id = newId()
  const now = Date.now()
  await db.insert(userImages).values({
    id,
    userId,
    url: `https://blob.example.com/test-${id}.jpg`,
    sortOrder: 0,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

describe('DELETE /api/images/:id', () => {
  it('returns 401 without token', async () => {
    const imageId = await createTestImage(modelId)
    const res = await app.request(`/api/images/${imageId}`, { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  it('returns 403 when model tries to delete image', async () => {
    const imageId = await createTestImage(modelId)
    const res = await app.request(`/api/images/${imageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${modelToken}` },
    })
    expect(res.status).toBe(403)
  })

  it('admin can soft-delete an image', async () => {
    const imageId = await createTestImage(modelId)
    const res = await app.request(`/api/images/${imageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)

    // Verify image is soft-deleted in DB
    const image = await db.query.userImages.findFirst({
      where: (img, { eq }) => eq(img.id, imageId),
    })
    expect(image?.isActive).toBe(0)
    expect(image?.deletedAt).not.toBeNull()
  })
})
