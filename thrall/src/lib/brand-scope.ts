import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { users, payMethods } from '../db/schema'

export async function findModelInBrand(modelId: string, brandId: string) {
  return db.query.users.findFirst({
    where: and(eq(users.id, modelId), eq(users.role, 'model'), eq(users.brandId, brandId), isNull(users.deletedAt)),
  })
}

export async function modelIdsForBrand(brandId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.brandId, brandId), eq(users.role, 'model')))
  return rows.map((r) => r.id)
}

export async function findPayMethodInBrand(payMethodId: string, brandId: string) {
  return db.query.payMethods.findFirst({
    where: and(eq(payMethods.id, payMethodId), eq(payMethods.brandId, brandId), isNull(payMethods.deletedAt)),
  })
}
