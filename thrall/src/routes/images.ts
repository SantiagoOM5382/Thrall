import { Hono } from 'hono'
import { eq, isNull } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { db } from '../db/client'
import { userImages } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'

export const imagesRoutes = new Hono<AppEnv>()
imagesRoutes.use('*', authMiddleware)

imagesRoutes.post('/users/:userId', async (c) => {
  const caller = c.get('user')
  const { userId } = c.req.param()

  // Modelo solo puede subir sus propias imágenes
  if (caller.role === 'model' && caller.sub !== userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }

  const blob = await put(`models/${userId}/${newId()}`, file, { access: 'public' })

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
  if (!['admin', 'monitor'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const existing = await db.query.userImages.findFirst({
    where: (img, { and, eq, isNull: isNullOp }) => and(eq(img.id, c.req.param('id')), isNullOp(img.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Date.now()
  await db.update(userImages)
    .set({ deletedAt: now, updatedAt: now, isActive: 0 })
    .where(eq(userImages.id, c.req.param('id')))

  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'image', entityId: c.req.param('id') })
  return c.json({ ok: true })
})
