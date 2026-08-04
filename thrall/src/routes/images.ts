import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { put, del as blobDel } from '@vercel/blob'
import { db } from '../db/client'
import { userImages, users } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'

const PREVIEW_ALLOWED_TYPES = new Set([
  'video/mp4', 'video/webm', 'image/gif',
])
const PREVIEW_MAX_BYTES = 15 * 1024 * 1024 // 15MB — enough for a short mp4 clip

export const imagesRoutes = new Hono<AppEnv>()
imagesRoutes.use('*', authMiddleware)

imagesRoutes.post('/users/:userId', async (c) => {
  const caller = c.get('user')
  const { userId } = c.req.param()

  const targetUser = await db.query.users.findFirst({
    where: (u, { and: andFn, eq: eqFn, isNull }) => andFn(eqFn(u.id, userId), isNull(u.deletedAt)),
  })
  if (!targetUser) return c.json({ error: 'Not found' }, 404)

  if (caller.role === 'model' && caller.sub !== userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  if (caller.role !== 'dev' && targetUser.brandId !== caller.brandId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }

  let blob
  try {
    blob = await put(`models/${userId}/${newId()}`, file, { access: 'public' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Blob upload failed'
    return c.json({ error: message }, 500)
  }

  const id = newId()
  const now = Date.now()
  await db.insert(userImages).values({
    id,
    userId,
    url: blob.url,
    sortOrder: 0,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  })

  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'image', entityId: id })
  return c.json({ id, url: blob.url }, 201)
})

imagesRoutes.delete('/:id', async (c) => {
  const caller = c.get('user')
  if (!['admin', 'monitor', 'dev'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const imageId = c.req.param('id')
  const rows = await db
    .select({
      imageId: userImages.id,
      imageBrandId: users.brandId,
    })
    .from(userImages)
    .innerJoin(users, eq(users.id, userImages.userId))
    .where(and(eq(userImages.id, imageId)))
    .limit(1)
  const existing = rows[0]
  if (!existing) return c.json({ error: 'Not found' }, 404)

  if (caller.role !== 'dev' && existing.imageBrandId !== caller.brandId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const now = Date.now()
  await db.update(userImages)
    .set({ deletedAt: now, updatedAt: now, isActive: 0 })
    .where(eq(userImages.id, imageId))

  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'image', entityId: imageId })
  return c.json({ ok: true })
})

// Animated hover preview for the illidan showcase card. One per model,
// stored as users.preview_url. Accepts mp4/webm/gif up to 15MB.
imagesRoutes.post('/users/:userId/preview', async (c) => {
  const caller = c.get('user')
  const { userId } = c.req.param()

  const targetUser = await db.query.users.findFirst({
    where: (u, { and: andFn, eq: eqFn, isNull }) => andFn(eqFn(u.id, userId), isNull(u.deletedAt)),
  })
  if (!targetUser) return c.json({ error: 'Not found' }, 404)
  if (targetUser.role !== 'model') return c.json({ error: 'preview_only_for_models' }, 400)

  if (caller.role === 'model' && caller.sub !== userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  if (caller.role !== 'dev' && targetUser.brandId !== caller.brandId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }
  if (!PREVIEW_ALLOWED_TYPES.has(file.type)) {
    return c.json({ error: 'invalid_type', allowed: [...PREVIEW_ALLOWED_TYPES] }, 400)
  }
  if (file.size > PREVIEW_MAX_BYTES) {
    return c.json({ error: 'file_too_large', maxBytes: PREVIEW_MAX_BYTES }, 400)
  }

  let blob
  try {
    blob = await put(`models/${userId}/preview-${newId()}`, file, { access: 'public' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Blob upload failed'
    return c.json({ error: message }, 500)
  }

  // Best-effort cleanup of the previous blob so we don't leak files.
  if (targetUser.previewUrl) {
    try { await blobDel(targetUser.previewUrl) } catch { /* non-fatal */ }
  }

  const now = Date.now()
  await db.update(users)
    .set({ previewUrl: blob.url, updatedAt: now })
    .where(eq(users.id, userId))

  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'user_preview', entityId: userId })
  return c.json({ previewUrl: blob.url }, 201)
})

imagesRoutes.delete('/users/:userId/preview', async (c) => {
  const caller = c.get('user')
  const { userId } = c.req.param()

  const targetUser = await db.query.users.findFirst({
    where: (u, { and: andFn, eq: eqFn, isNull }) => andFn(eqFn(u.id, userId), isNull(u.deletedAt)),
  })
  if (!targetUser) return c.json({ error: 'Not found' }, 404)
  if (caller.role === 'model' && caller.sub !== userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  if (caller.role !== 'dev' && targetUser.brandId !== caller.brandId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  if (targetUser.previewUrl) {
    try { await blobDel(targetUser.previewUrl) } catch { /* non-fatal */ }
  }
  const now = Date.now()
  await db.update(users).set({ previewUrl: null, updatedAt: now }).where(eq(users.id, userId))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'user_preview', entityId: userId })
  return c.json({ ok: true })
})
