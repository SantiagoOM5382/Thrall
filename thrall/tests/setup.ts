import { beforeAll } from 'vitest'

beforeAll(async () => {
  const { migrate } = await import('drizzle-orm/libsql/migrator')
  const { db } = await import('../src/db/client')
  await migrate(db, { migrationsFolder: './migrations' })
})
