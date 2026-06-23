import { Hono } from 'hono'
import { db } from '../db/client'

export const modelsRoutes = new Hono()

modelsRoutes.get('/', async (c) => {
  const models = await db.query.users.findMany({
    where: (u, { and, eq, isNull }) =>
      and(eq(u.role, 'model'), eq(u.isActive, 1), isNull(u.deletedAt)),
  })

  const result = await Promise.all(
    models.map(async (m) => {
      const images = await db.query.userImages.findMany({
        where: (img, { and, eq, isNull }) =>
          and(eq(img.userId, m.id), eq(img.isActive, 1), isNull(img.deletedAt)),
        orderBy: (img, { asc }) => [asc(img.sortOrder)],
      })
      const { password: _, ...model } = m
      return { ...model, images: images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })) }
    })
  )

  return c.json(result)
})

modelsRoutes.get('/:id', async (c) => {
  const model = await db.query.users.findFirst({
    where: (u, { and, eq, isNull }) =>
      and(eq(u.id, c.req.param('id')), eq(u.role, 'model'), isNull(u.deletedAt)),
  })
  if (!model) return c.json({ error: 'Not found' }, 404)

  const images = await db.query.userImages.findMany({
    where: (img, { and, eq, isNull }) =>
      and(eq(img.userId, model.id), eq(img.isActive, 1), isNull(img.deletedAt)),
    orderBy: (img, { asc }) => [asc(img.sortOrder)],
  })

  const { password: _, ...rest } = model
  return c.json({ ...rest, images: images.map((i) => ({ id: i.id, url: i.url })) })
})
