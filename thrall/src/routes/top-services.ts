import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { topServices } from '../db/schema'

export const topServicesRoutes = new Hono()

topServicesRoutes.get('/', async (c) => {
  const rows = await db
    .select({
      id: topServices.id,
      code: topServices.code,
      displayName: topServices.displayName,
      tokensCost: topServices.tokensCost,
      durationHours: topServices.durationHours,
    })
    .from(topServices)
    .where(eq(topServices.isActive, 1))
  return c.json(rows)
})
