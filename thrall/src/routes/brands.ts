import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { brands, brandSubscriptions } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'

export const brandsRoutes = new Hono<AppEnv>()
brandsRoutes.use('*', authMiddleware, requireRole('dev'))

const createSchema = z.object({ name: z.string().min(1) })
const updateSchema = z.object({ name: z.string().min(1).optional(), isActive: z.number().int().optional() })

brandsRoutes.get('/', async (c) => {
  const all = await db.query.brands.findMany({ orderBy: (b, { desc }) => [desc(b.createdAt)] })
  return c.json(all)
})

brandsRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const { name } = c.req.valid('json')
  const id = newId()
  const now = Date.now()
  await db.insert(brands).values({ id, name, isActive: 1, createdAt: now, updatedAt: now })
  await db.insert(brandSubscriptions).values({
    id: newId(), brandId: id, plan: 'pilot', isActive: 1, createdAt: now, updatedAt: now,
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'brand', entityId: id })
  const created = await db.query.brands.findFirst({ where: eq(brands.id, id) })
  return c.json(created, 201)
})

brandsRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')!
  const existing = await db.query.brands.findFirst({ where: eq(brands.id, id) })
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await db.update(brands).set({ ...c.req.valid('json'), updatedAt: Date.now() }).where(eq(brands.id, id))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'brand', entityId: id })
  const updated = await db.query.brands.findFirst({ where: eq(brands.id, id) })
  return c.json(updated)
})
