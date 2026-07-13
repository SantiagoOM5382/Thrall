import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/client'
import { brands, users } from '../src/db/schema'
import { newId } from '../src/lib/ulid'
import { hashPassword } from '../src/lib/hash'

async function main() {
  const existing = await db.query.users.findFirst({ where: eq(users.email, 'dev@arthas.co') })
  if (existing) {
    console.log('Dev already exists — nothing to do.')
    process.exit(0)
  }
  let platform = await db.query.brands.findFirst({ where: eq(brands.name, 'Plataforma') })
  if (!platform) {
    const id = newId()
    await db.insert(brands).values({ id, name: 'Plataforma', isActive: 1, createdAt: Date.now(), updatedAt: Date.now() })
    platform = await db.query.brands.findFirst({ where: eq(brands.id, id) })
  }
  await db.insert(users).values({
    id: newId(), brandId: platform!.id, name: 'Dev', email: 'dev@arthas.co',
    password: await hashPassword('Dev1234!'), role: 'dev', isActive: 1,
    createdAt: Date.now(), updatedAt: Date.now(),
  })
  console.log('✓ Dev created: dev@arthas.co / Dev1234!')
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
