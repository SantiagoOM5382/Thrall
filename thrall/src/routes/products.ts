import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { products } from '../db/schema'

export const productsRoutes = new Hono()

productsRoutes.get('/', async (c) => {
  const type = (c.req.query('type') ?? 'SUBSCRIPTION') as 'SUBSCRIPTION' | 'TOKEN_PACK'
  const rows = await db
    .select({
      id: products.id,
      code: products.code,
      type: products.type,
      displayName: products.displayName,
      priceCop: products.priceCop,
      durationDays: products.durationDays,
      tokensGranted: products.tokensGranted,
    })
    .from(products)
    .where(and(eq(products.type, type), eq(products.isActive, 1)))
  return c.json(rows)
})
