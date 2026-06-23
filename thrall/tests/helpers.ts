import { db } from '../src/db/client'
import { brands, users, payMethods, services, serviceExtras, brandSubscriptions } from '../src/db/schema'
import { newId } from '../src/lib/ulid'
import { hashPassword } from '../src/lib/hash'
import { signToken } from '../src/lib/jwt'

export async function createTestBrand() {
  const id = newId()
  await db.insert(brands).values({
    id,
    name: 'Test Brand',
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  await db.insert(brandSubscriptions).values({
    id: newId(),
    brandId: id,
    plan: 'pilot',
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  return id
}

export async function createTestUser(
  brandId: string,
  overrides: Partial<{ role: 'admin' | 'monitor' | 'model'; email: string; name: string }> = {}
) {
  const id = newId()
  const email = overrides.email ?? `user-${id}@test.com`
  await db.insert(users).values({
    id,
    brandId,
    name: overrides.name ?? 'Test User',
    email,
    password: await hashPassword('password123'),
    role: overrides.role ?? 'admin',
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  return { id, email, password: 'password123' }
}

export async function tokenFor(userId: string, role: 'admin' | 'monitor' | 'model', brandId: string) {
  return signToken({ sub: userId, role, brandId, name: 'Test' })
}

export async function createTestPayMethod(brandId: string) {
  const id = newId()
  await db.insert(payMethods).values({
    id,
    code: `PM${id.slice(0, 4)}`,
    displayName: 'Nequi Santiago',
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  return id
}

export async function createTestService(
  modelId: string,
  createdBy: string,
  payMethodId: string,
  extraAmounts: number[] = []
) {
  const id = newId()
  const now = Date.now()
  await db.insert(services).values({
    id,
    modelId,
    createdBy,
    startTime: now - 3600000,
    endTime: now,
    basePrice: 100000,
    payMethodId,
    createdAt: now,
    updatedAt: now,
  })
  for (const amount of extraAmounts) {
    await db.insert(serviceExtras).values({
      id: newId(),
      serviceId: id,
      description: 'Extra',
      amount,
      createdAt: now,
    })
  }
  return id
}
