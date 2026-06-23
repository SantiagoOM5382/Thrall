import { db } from '../src/db/client'
import { brands, users } from '../src/db/schema'
import { newId } from '../src/lib/ulid'
import { hashPassword } from '../src/lib/hash'

export async function createTestBrand(overrides: Partial<typeof brands.$inferInsert> = {}) {
  const id = newId()
  const now = Date.now()
  const brand = {
    id,
    name: 'Test Brand',
    isActive: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  await db.insert(brands).values(brand)
  return brand
}

export async function createTestUser(
  brandId: string,
  overrides: Partial<typeof users.$inferInsert> = {}
) {
  const id = newId()
  const now = Date.now()
  const user = {
    id,
    brandId,
    name: 'Test User',
    email: `user-${id}@example.com`,
    password: await hashPassword('password123'),
    role: 'admin' as const,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  await db.insert(users).values(user)
  return user
}
