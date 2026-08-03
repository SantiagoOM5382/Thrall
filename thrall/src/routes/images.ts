import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { db } from '../db/client'
import { userImages, users } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'

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
