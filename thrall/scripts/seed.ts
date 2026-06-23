import 'dotenv/config'
import { db } from '../src/db/client'
import { brands, users, payMethods, brandSubscriptions } from '../src/db/schema'
import { newId } from '../src/lib/ulid'
import { hashPassword } from '../src/lib/hash'

async function seed() {
  console.log('Seeding database...')

  const brandId = newId()
  await db.insert(brands).values({
    id: brandId,
    name: 'Arthas',
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  await db.insert(brandSubscriptions).values({
    id: newId(),
    brandId,
    plan: 'pilot',
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  await db.insert(users).values({
    id: newId(),
    brandId,
    name: 'Administrador',
    email: 'admin@arthas.co',
    password: await hashPassword('Admin1234!'),
    role: 'admin',
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  const payMethodsData = [
    { code: 'NQST', displayName: 'Nequi Santiago' },
    { code: 'NQCA', displayName: 'Nequi Camilo' },
    { code: 'BCST', displayName: 'Bancolombia Santiago' },
    { code: 'BCLS', displayName: 'Bancolombia Lisandro' },
    { code: 'DP',   displayName: 'Daviplata' },
    { code: 'DVCA', displayName: 'Davivienda Camilo' },
  ]

  for (const pm of payMethodsData) {
    await db.insert(payMethods).values({
      id: newId(),
      code: pm.code,
      displayName: pm.displayName,
      isActive: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  console.log('✓ Seed complete')
  console.log('  Admin: admin@arthas.co / Admin1234!')
  process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) })
