# Thrall — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete REST API backend for Arthas — autenticación JWT, gestión de usuarios/modelos/servicios, cálculo de ganancias, y uploads de imágenes.

**Architecture:** Hono.js desplegado como Vercel Functions (Node.js runtime). Drizzle ORM contra Turso (LibSQL). JWT stateless con jose. Imágenes en Vercel Blob. Un módulo por dominio en `src/routes/`.

**Tech Stack:** Node.js 20, Hono 4, Drizzle ORM, @libsql/client, Turso, jose, bcryptjs, ulidx, zod, @vercel/blob, Vitest

## Global Constraints

- Runtime: Node.js (no edge) — requerido para bcryptjs
- Precios: siempre `INTEGER` (pesos colombianos, sin decimales)
- IDs: siempre ULID (`ulidx`) como `TEXT`
- Timestamps: `INTEGER` unix ms (`Date.now()`)
- Soft delete: campo `deleted_at INTEGER NULL` en users, services, user_images, pay_methods
- Timezone de negocio: `America/Bogota` (UTC−5) para cálculo de "hoy"
- `display_name` de pay_methods: solo visible para role `admin`
- Ganancias: nunca persistir — siempre calcular. modelo=60% base + 100% extras; empresa=40% base
- Variables de entorno requeridas: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`

---

## File Map

```
thrall/
├── package.json
├── tsconfig.json
├── vercel.json
├── drizzle.config.ts
├── vitest.config.ts
├── .env.example
├── api/
│   └── index.ts              # Vercel entry point
├── src/
│   ├── app.ts                # Hono app — monta todas las rutas
│   ├── db/
│   │   ├── client.ts         # Turso client + drizzle instance
│   │   └── schema.ts         # Todas las tablas Drizzle
│   ├── lib/
│   │   ├── ulid.ts           # Wrapper newId()
│   │   ├── jwt.ts            # signToken / verifyToken
│   │   ├── hash.ts           # hashPassword / comparePassword
│   │   ├── timezone.ts       # getTodayRangeInBogota()
│   │   ├── earnings.ts       # calcEarnings()
│   │   └── audit.ts          # logAudit()
│   ├── middleware/
│   │   ├── auth.ts           # Valida JWT, inyecta user en contexto
│   │   └── rbac.ts           # requireRole(...roles)
│   ├── serializers/
│   │   └── pay-method.ts     # strip display_name si no es admin
│   └── routes/
│       ├── auth.ts           # POST /login, GET /me
│       ├── users.ts          # CRUD usuarios [admin]
│       ├── models.ts         # GET modelos públicas
│       ├── images.ts         # POST/DELETE imágenes
│       ├── pay-methods.ts    # CRUD métodos de pago
│       ├── services.ts       # CRUD servicios
│       └── reports.ts        # Reportes y ranking
├── scripts/
│   └── seed.ts               # Brand inicial + admin + pay_methods
└── tests/
    ├── setup.ts              # DB en memoria + env vars de test
    ├── helpers.ts            # createTestUser, createTestService, etc.
    ├── lib/
    │   ├── earnings.test.ts
    │   └── timezone.test.ts
    └── routes/
        ├── auth.test.ts
        ├── users.test.ts
        ├── models.test.ts
        ├── images.test.ts
        ├── pay-methods.test.ts
        ├── services.test.ts
        └── reports.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `thrall/package.json`
- Create: `thrall/tsconfig.json`
- Create: `thrall/vercel.json`
- Create: `thrall/drizzle.config.ts`
- Create: `thrall/vitest.config.ts`
- Create: `thrall/.env.example`

**Interfaces:**
- Produces: proyecto npm funcional con todos los deps instalados

- [ ] **Step 1: Crear el directorio e inicializar npm**

```bash
cd thrall
npm init -y
```

- [ ] **Step 2: Instalar dependencias de producción**

```bash
npm install hono @hono/zod-validator zod drizzle-orm @libsql/client jose bcryptjs ulidx @vercel/blob
```

- [ ] **Step 3: Instalar dependencias de desarrollo**

```bash
npm install -D typescript tsx @types/node @types/bcryptjs drizzle-kit vitest
```

- [ ] **Step 4: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "api", "scripts", "tests"]
}
```

- [ ] **Step 5: Crear `vercel.json`**

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index" }
  ]
}
```

- [ ] **Step 6: Crear `drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config
```

- [ ] **Step 7: Crear `vitest.config.ts`**

Las env vars van aquí — Vitest las inyecta antes de cargar cualquier módulo, evitando el hoisting ESM que rompería el cliente de Turso si se pusieran en setup.ts.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    globals: true,
    env: {
      TURSO_DATABASE_URL: ':memory:',
      JWT_SECRET: 'test-secret-minimum-32-characters!!',
      BLOB_READ_WRITE_TOKEN: 'test-blob-token',
    },
  },
})
```

- [ ] **Step 8: Crear `.env.example`**

```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
JWT_SECRET=change-me-to-32-chars-minimum-secret
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

- [ ] **Step 9: Agregar scripts a `package.json`**

Editar `package.json` para que el bloque `"scripts"` quede:

```json
"scripts": {
  "dev": "tsx watch src/app.ts",
  "build": "tsc",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "seed": "tsx scripts/seed.ts"
}
```

- [ ] **Step 10: Commit**

```bash
git init
echo "node_modules\n.env\ndist\n.turso" > .gitignore
git add .
git commit -m "chore: scaffold thrall project"
```

---

## Task 2: Database Schema

**Files:**
- Create: `thrall/src/db/schema.ts`
- Create: `thrall/src/db/client.ts`

**Interfaces:**
- Produces: `db` (drizzle instance), tablas exportadas: `brands`, `users`, `userImages`, `payMethods`, `services`, `serviceExtras`, `auditLogs`, `brandSubscriptions`

- [ ] **Step 1: Crear `src/db/client.ts`**

```ts
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })
export type DB = typeof db
```

- [ ] **Step 2: Crear `src/db/schema.ts`**

```ts
import { text, integer, sqliteTable, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const brands = sqliteTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'monitor', 'model'] }).notNull(),
  phone: text('phone'),
  telegram: text('telegram'),
  description: text('description'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
}))

export const userImages = sqliteTable('user_images', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const payMethods = sqliteTable('pay_methods', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  displayName: text('display_name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  codeIdx: uniqueIndex('pay_methods_code_idx').on(t.code),
}))

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time').notNull(),
  basePrice: integer('base_price').notNull(),
  payMethodId: text('pay_method_id').notNull().references(() => payMethods.id),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const serviceExtras = sqliteTable('service_extras', {
  id: text('id').primaryKey(),
  serviceId: text('service_id').notNull().references(() => services.id),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  action: text('action', { enum: ['CREATE', 'UPDATE', 'DELETE'] }).notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
})

export const brandSubscriptions = sqliteTable('brand_subscriptions', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  plan: text('plan').notNull().default('pilot'),
  isActive: integer('is_active').notNull().default(1),
  paidUntil: integer('paid_until'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
```

- [ ] **Step 3: Generar migraciones**

```bash
npm run db:generate
```

Expected: carpeta `migrations/` creada con un archivo SQL.

- [ ] **Step 4: Commit**

```bash
git add src/db/ migrations/ drizzle.config.ts
git commit -m "feat: add database schema and initial migration"
```

---

## Task 3: Core Utilities

**Files:**
- Create: `thrall/src/lib/ulid.ts`
- Create: `thrall/src/lib/jwt.ts`
- Create: `thrall/src/lib/hash.ts`
- Create: `thrall/src/lib/timezone.ts`
- Create: `thrall/src/lib/earnings.ts`
- Create: `thrall/src/lib/audit.ts`
- Create: `thrall/tests/setup.ts`
- Create: `thrall/tests/lib/earnings.test.ts`
- Create: `thrall/tests/lib/timezone.test.ts`

**Interfaces:**
- Produces:
  - `newId(): string`
  - `signToken(payload: TokenPayload): Promise<string>`
  - `verifyToken(token: string): Promise<TokenPayload>`
  - `hashPassword(plain: string): Promise<string>`
  - `comparePassword(plain: string, hash: string): Promise<boolean>`
  - `getTodayRangeInBogota(): { start: number; end: number }`
  - `calcEarnings(basePrice: number, extraAmounts: number[]): EarningsResult`
  - `logAudit(db, params): Promise<void>`

- [ ] **Step 1: Crear `tests/setup.ts`**

Usar dynamic imports — las env vars ya están seteadas por vitest.config.ts antes de este archivo.

```ts
beforeAll(async () => {
  const { migrate } = await import('drizzle-orm/libsql/migrator')
  const { db } = await import('../src/db/client')
  await migrate(db, { migrationsFolder: './migrations' })
})
```

- [ ] **Step 2: Crear `src/lib/ulid.ts`**

```ts
import { ulid } from 'ulidx'

export function newId(): string {
  return ulid()
}
```

- [ ] **Step 3: Escribir tests de earnings**

```ts
// tests/lib/earnings.test.ts
import { describe, it, expect } from 'vitest'
import { calcEarnings } from '../../src/lib/earnings'

describe('calcEarnings', () => {
  it('splits base 60/40 with no extras', () => {
    const result = calcEarnings(100000, [])
    expect(result.modelBase).toBe(60000)
    expect(result.company).toBe(40000)
    expect(result.modelExtras).toBe(0)
    expect(result.modelTotal).toBe(60000)
  })

  it('assigns extras 100% to model', () => {
    const result = calcEarnings(100000, [20000, 15000])
    expect(result.modelExtras).toBe(35000)
    expect(result.modelTotal).toBe(95000)
    expect(result.company).toBe(40000)
  })

  it('rounds fractional cents', () => {
    const result = calcEarnings(100001, [])
    expect(result.modelBase + result.company).toBe(100001)
  })
})
```

- [ ] **Step 4: Correr tests y confirmar que fallan**

```bash
npm test tests/lib/earnings.test.ts
```

Expected: FAIL — `Cannot find module '../../src/lib/earnings'`

- [ ] **Step 5: Crear `src/lib/earnings.ts`**

```ts
export interface EarningsResult {
  modelBase: number
  company: number
  modelExtras: number
  modelTotal: number
}

export function calcEarnings(basePrice: number, extraAmounts: number[]): EarningsResult {
  const modelBase = Math.round(basePrice * 0.6)
  const company = basePrice - modelBase
  const modelExtras = extraAmounts.reduce((sum, n) => sum + n, 0)
  return {
    modelBase,
    company,
    modelExtras,
    modelTotal: modelBase + modelExtras,
  }
}
```

- [ ] **Step 6: Correr tests y confirmar que pasan**

```bash
npm test tests/lib/earnings.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 7: Escribir tests de timezone**

```ts
// tests/lib/timezone.test.ts
import { describe, it, expect } from 'vitest'
import { getTodayRangeInBogota } from '../../src/lib/timezone'

describe('getTodayRangeInBogota', () => {
  it('returns start and end as unix ms integers', () => {
    const { start, end } = getTodayRangeInBogota()
    expect(typeof start).toBe('number')
    expect(typeof end).toBe('number')
    expect(end).toBeGreaterThan(start)
  })

  it('range spans exactly one day (86400000 ms)', () => {
    const { start, end } = getTodayRangeInBogota()
    expect(end - start).toBe(86400000 - 1000)
  })

  it('start is midnight Bogota time', () => {
    const { start } = getTodayRangeInBogota()
    const d = new Date(start)
    const bogotaHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      hour12: false,
    }).format(d)
    expect(bogotaHour).toBe('0')
  })
})
```

- [ ] **Step 8: Crear `src/lib/timezone.ts`**

```ts
export function getTodayRangeInBogota(): { start: number; end: number } {
  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const start = new Date(`${dateStr}T00:00:00-05:00`).getTime()
  const end = new Date(`${dateStr}T23:59:59-05:00`).getTime()
  return { start, end }
}
```

- [ ] **Step 9: Correr todos los tests de lib**

```bash
npm test tests/lib/
```

Expected: PASS (6 tests)

- [ ] **Step 10: Crear `src/lib/jwt.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose'

export interface TokenPayload {
  sub: string
  role: 'admin' | 'monitor' | 'model'
  brandId: string
  name: string
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as TokenPayload
}
```

- [ ] **Step 11: Crear `src/lib/hash.ts`**

```ts
import bcrypt from 'bcryptjs'

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed)
}
```

- [ ] **Step 12: Crear `src/lib/audit.ts`**

```ts
import type { DB } from '../db/client'
import { auditLogs } from '../db/schema'
import { newId } from './ulid'

export async function logAudit(
  db: DB,
  params: {
    userId: string
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    entity: string
    entityId: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await db.insert(auditLogs).values({
    id: newId(),
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAt: Date.now(),
  })
}
```

- [ ] **Step 13: Commit**

```bash
git add src/lib/ tests/
git commit -m "feat: add core utilities and tests (earnings, timezone, jwt, hash, audit)"
```

---

## Task 4: Auth Middleware & RBAC

**Files:**
- Create: `thrall/src/middleware/auth.ts`
- Create: `thrall/src/middleware/rbac.ts`

**Interfaces:**
- Consumes: `verifyToken(token): Promise<TokenPayload>` de `src/lib/jwt.ts`
- Produces:
  - Middleware `authMiddleware` — inyecta `c.get('user'): TokenPayload` en el contexto Hono
  - `requireRole(...roles: string[])` — retorna middleware que responde 403 si el role no está en la lista
  - Tipo Hono: `type AppEnv = { Variables: { user: TokenPayload } }`

- [ ] **Step 1: Crear `src/middleware/auth.ts`**

```ts
import type { Context, Next } from 'hono'
import { verifyToken, type TokenPayload } from '../lib/jwt'

export type AppEnv = {
  Variables: {
    user: TokenPayload
  }
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = header.slice(7)
  try {
    const payload = await verifyToken(token)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}
```

- [ ] **Step 2: Crear `src/middleware/rbac.ts`**

```ts
import type { Context, Next } from 'hono'
import type { AppEnv } from './auth'

export function requireRole(...roles: Array<'admin' | 'monitor' | 'model'>) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware/
git commit -m "feat: add auth middleware and RBAC"
```

---

## Task 5: Auth Routes

**Files:**
- Create: `thrall/src/routes/auth.ts`
- Create: `thrall/tests/routes/auth.test.ts`
- Create: `thrall/tests/helpers.ts`

**Interfaces:**
- Consumes: `db`, `users` schema, `hashPassword`, `comparePassword`, `signToken`, `authMiddleware`
- Produces:
  - `POST /login` → `{ token: string, user: { id, name, role, brandId } }`
  - `GET /me` → `{ id, name, role, brandId }`
  - `authRoutes: Hono` — router exportado

- [ ] **Step 1: Crear `tests/helpers.ts`**

```ts
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
```

- [ ] **Step 2: Escribir tests de auth**

```ts
// tests/routes/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authRoutes } from '../../src/routes/auth'
import { createTestBrand, createTestUser } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/auth', authRoutes)

let brandId: string
let userId: string
let userEmail: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const user = await createTestUser(brandId, { role: 'admin', email: `admin-${Date.now()}@test.com` })
  userId = user.id
  userEmail = user.email
})

describe('POST /api/auth/login', () => {
  it('returns token on valid credentials', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'password123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.token).toBeDefined()
    expect(body.user.role).toBe('admin')
  })

  it('returns 401 on wrong password', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 on unknown email', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('returns user data with valid token', async () => {
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'password123' }),
    })
    const { token } = await loginRes.json() as any

    const res = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBe(userId)
  })

  it('returns 401 without token', async () => {
    const res = await app.request('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 3: Correr tests y confirmar que fallan**

```bash
npm test tests/routes/auth.test.ts
```

Expected: FAIL — `Cannot find module '../../src/routes/auth'`

- [ ] **Step 4: Crear `src/routes/auth.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../db/schema'
import { comparePassword } from '../lib/hash'
import { signToken } from '../lib/jwt'
import { authMiddleware, type AppEnv } from '../middleware/auth'

export const authRoutes = new Hono<AppEnv>()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (!user || user.isActive === 0 || user.deletedAt !== null) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const valid = await comparePassword(password, user.password)
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = await signToken({
    sub: user.id,
    role: user.role,
    brandId: user.brandId,
    name: user.name,
  })

  return c.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, brandId: user.brandId },
  })
})

authRoutes.get('/me', authMiddleware, (c) => {
  const user = c.get('user')
  return c.json({ id: user.sub, name: user.name, role: user.role, brandId: user.brandId })
})
```

- [ ] **Step 5: Correr tests y confirmar que pasan**

```bash
npm test tests/routes/auth.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/routes/auth.ts tests/routes/auth.test.ts tests/helpers.ts
git commit -m "feat: auth routes (login, me) with tests"
```

---

## Task 6: Users Routes

**Files:**
- Create: `thrall/src/routes/users.ts`
- Create: `thrall/tests/routes/users.test.ts`

**Interfaces:**
- Consumes: `db`, `users` schema, `authMiddleware`, `requireRole`, `newId`, `hashPassword`, `logAudit`
- Produces:
  - `GET /` → lista de usuarios (sin password)
  - `POST /` → crea usuario, retorna sin password
  - `GET /:id` → usuario por id
  - `PUT /:id` → edita usuario
  - `DELETE /:id` → soft delete
  - `usersRoutes: Hono`

- [ ] **Step 1: Escribir tests de users**

```ts
// tests/routes/users.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { usersRoutes } from '../../src/routes/users'
import { authMiddleware } from '../../src/middleware/auth'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/users', usersRoutes)

let brandId: string
let adminToken: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `admin-${Date.now()}@test.com` })
  adminToken = await tokenFor(admin.id, 'admin', brandId)
})

describe('GET /api/users', () => {
  it('returns users list for admin', async () => {
    const res = await app.request('/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.every((u: any) => u.password === undefined)).toBe(true)
  })

  it('returns 401 without token', async () => {
    const res = await app.request('/api/users')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/users', () => {
  it('creates a new user', async () => {
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Nueva Modelo',
        email: `model-${Date.now()}@test.com`,
        password: 'pass1234',
        role: 'model',
        brandId,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBeDefined()
    expect(body.password).toBeUndefined()
  })
})

describe('DELETE /api/users/:id', () => {
  it('soft deletes a user', async () => {
    const user = await createTestUser(brandId, { role: 'model', email: `del-${Date.now()}@test.com` })
    const res = await app.request(`/api/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Correr tests y confirmar que fallan**

```bash
npm test tests/routes/users.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Crear `src/routes/users.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { hashPassword } from '../lib/hash'
import { logAudit } from '../lib/audit'

export const usersRoutes = new Hono<AppEnv>()
usersRoutes.use('*', authMiddleware, requireRole('admin'))

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'monitor', 'model']),
  brandId: z.string(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().optional(),
})

const updateSchema = createSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
})

function omitPassword<T extends { password?: string }>(u: T): Omit<T, 'password'> {
  const { password: _, ...rest } = u
  return rest
}

usersRoutes.get('/', async (c) => {
  const all = await db.query.users.findMany({
    where: (u, { isNull }) => isNull(u.deletedAt),
  })
  return c.json(all.map(omitPassword))
})

usersRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json')
  const caller = c.get('user')
  const id = newId()
  const now = Date.now()

  await db.insert(users).values({
    id,
    ...data,
    password: await hashPassword(data.password),
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  })

  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'user', entityId: id })

  const created = await db.query.users.findFirst({ where: eq(users.id, id) })
  return c.json(omitPassword(created!), 201)
})

usersRoutes.get('/:id', async (c) => {
  const user = await db.query.users.findFirst({
    where: (u, { and, eq, isNull }) => and(eq(u.id, c.req.param('id')), isNull(u.deletedAt)),
  })
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(omitPassword(user))
})

usersRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const data = c.req.valid('json')
  const caller = c.get('user')
  const now = Date.now()

  const patch: Record<string, unknown> = { ...data, updatedAt: now }
  if (data.password) patch.password = await hashPassword(data.password)

  await db.update(users).set(patch).where(eq(users.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'user', entityId: c.req.param('id') })

  const updated = await db.query.users.findFirst({ where: eq(users.id, c.req.param('id')) })
  return c.json(omitPassword(updated!))
})

usersRoutes.delete('/:id', async (c) => {
  const caller = c.get('user')
  const now = Date.now()
  await db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'user', entityId: c.req.param('id') })
  return c.json({ ok: true })
})
```

- [ ] **Step 4: Correr tests y confirmar que pasan**

```bash
npm test tests/routes/users.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/users.ts tests/routes/users.test.ts
git commit -m "feat: users CRUD routes with soft delete and audit log"
```

---

## Task 7: Models Routes (Público) + Images Routes

**Files:**
- Create: `thrall/src/routes/models.ts`
- Create: `thrall/src/routes/images.ts`
- Create: `thrall/tests/routes/models.test.ts`
- Create: `thrall/tests/routes/images.test.ts`

**Interfaces:**
- Consumes: `db`, `users`, `userImages` schema, `authMiddleware`, `requireRole`, `newId`, `logAudit`, `@vercel/blob`
- Produces:
  - `GET /models` → modelos activas con imágenes (público, sin auth)
  - `GET /models/:id` → perfil de modelo (público)
  - `POST /images/users/:id` → sube imagen a Vercel Blob, guarda URL en DB
  - `DELETE /images/:id` → soft delete de imagen [admin, monitor]
  - `modelsRoutes: Hono`, `imagesRoutes: Hono`

- [ ] **Step 1: Escribir tests de models**

```ts
// tests/routes/models.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { modelsRoutes } from '../../src/routes/models'
import { createTestBrand, createTestUser } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/models', modelsRoutes)

let brandId: string

beforeEach(async () => {
  brandId = await createTestBrand()
})

describe('GET /api/models', () => {
  it('returns public list without auth', async () => {
    await createTestUser(brandId, { role: 'model', email: `m-${Date.now()}@test.com`, name: 'Ana' })
    const res = await app.request('/api/models')
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.every((u: any) => u.password === undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Crear `src/routes/models.ts`**

```ts
import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { users, userImages } from '../db/schema'

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
```

- [ ] **Step 3: Crear `src/routes/images.ts`**

```ts
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { db } from '../db/client'
import { userImages } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'

export const imagesRoutes = new Hono<AppEnv>()
imagesRoutes.use('*', authMiddleware)

imagesRoutes.post('/users/:userId', async (c) => {
  const caller = c.get('user')
  const { userId } = c.req.param()

  // Modelo solo puede subir sus propias imágenes
  if (caller.role === 'model' && caller.sub !== userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }

  const blob = await put(`models/${userId}/${newId()}`, file, { access: 'public' })

  const id = newId()
  const now = Date.now()
  await db.insert(userImages).values({
    id,
    userId,
    url: blob.url,
    sortOrder: 0,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  })

  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'image', entityId: id })
  return c.json({ id, url: blob.url }, 201)
})

imagesRoutes.delete('/:id', async (c) => {
  const caller = c.get('user')
  if (!['admin', 'monitor'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const now = Date.now()
  await db.update(userImages)
    .set({ deletedAt: now, updatedAt: now, isActive: 0 })
    .where(eq(userImages.id, c.req.param('id')))

  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'image', entityId: c.req.param('id') })
  return c.json({ ok: true })
})
```

- [ ] **Step 4: Correr tests de models**

```bash
npm test tests/routes/models.test.ts
```

Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/routes/models.ts src/routes/images.ts tests/routes/models.test.ts
git commit -m "feat: public models routes and images upload/delete"
```

---

## Task 8: Pay-Methods Routes + Serializer

**Files:**
- Create: `thrall/src/serializers/pay-method.ts`
- Create: `thrall/src/routes/pay-methods.ts`
- Create: `thrall/tests/routes/pay-methods.test.ts`

**Interfaces:**
- Consumes: `db`, `payMethods` schema, `authMiddleware`, `requireRole`, `newId`, `logAudit`
- Produces:
  - `serializePayMethod(pm, role): object` — omite `displayName` si role !== 'admin'
  - `GET /pay-methods` → lista (displayName solo para admin)
  - `POST /pay-methods` → [admin]
  - `PUT /pay-methods/:id` → [admin]
  - `DELETE /pay-methods/:id` → soft delete [admin]
  - `payMethodsRoutes: Hono`

- [ ] **Step 1: Escribir test del serializer**

```ts
// tests/routes/pay-methods.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { payMethodsRoutes } from '../../src/routes/pay-methods'
import { serializePayMethod } from '../../src/serializers/pay-method'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

// Unit test serializer
describe('serializePayMethod', () => {
  const pm = { id: '1', code: 'NQST', displayName: 'Nequi Santiago', isActive: 1 }

  it('includes displayName for admin', () => {
    const result = serializePayMethod(pm, 'admin')
    expect(result).toHaveProperty('displayName', 'Nequi Santiago')
  })

  it('omits displayName for monitor', () => {
    const result = serializePayMethod(pm, 'monitor')
    expect(result).not.toHaveProperty('displayName')
  })

  it('omits displayName for model', () => {
    const result = serializePayMethod(pm, 'model')
    expect(result).not.toHaveProperty('displayName')
  })
})

// Integration tests
const app = new Hono().basePath('/api')
app.route('/pay-methods', payMethodsRoutes)

let brandId: string
let adminToken: string
let monitorToken: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `admin-pm-${Date.now()}@test.com` })
  adminToken = await tokenFor(admin.id, 'admin', brandId)
  const monitor = await createTestUser(brandId, { role: 'monitor', email: `mon-${Date.now()}@test.com` })
  monitorToken = await tokenFor(monitor.id, 'monitor', brandId)
})

describe('GET /api/pay-methods', () => {
  it('admin sees displayName', async () => {
    await app.request('/api/pay-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'NQST', displayName: 'Nequi Santiago' }),
    })
    const res = await app.request('/api/pay-methods', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const body = await res.json() as any[]
    expect(body[0]).toHaveProperty('displayName')
  })

  it('monitor sees only code', async () => {
    const res = await app.request('/api/pay-methods', {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    const body = await res.json() as any[]
    if (body.length > 0) {
      expect(body[0]).not.toHaveProperty('displayName')
    }
  })
})
```

- [ ] **Step 2: Crear `src/serializers/pay-method.ts`**

```ts
interface PayMethodRow {
  id: string
  code: string
  displayName: string
  isActive: number
}

export function serializePayMethod(pm: PayMethodRow, role: string) {
  if (role === 'admin') {
    return { id: pm.id, code: pm.code, displayName: pm.displayName, isActive: pm.isActive }
  }
  return { id: pm.id, code: pm.code, isActive: pm.isActive }
}
```

- [ ] **Step 3: Crear `src/routes/pay-methods.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { payMethods } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { serializePayMethod } from '../serializers/pay-method'

export const payMethodsRoutes = new Hono<AppEnv>()
payMethodsRoutes.use('*', authMiddleware)

const bodySchema = z.object({
  code: z.string().min(1).toUpperCase(),
  displayName: z.string().min(1),
})

payMethodsRoutes.get('/', async (c) => {
  const role = c.get('user').role
  const all = await db.query.payMethods.findMany({
    where: (pm, { isNull }) => isNull(pm.deletedAt),
  })
  return c.json(all.map((pm) => serializePayMethod(pm, role)))
})

payMethodsRoutes.post('/', requireRole('admin'), zValidator('json', bodySchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')
  const id = newId()
  const now = Date.now()

  await db.insert(payMethods).values({ id, ...data, isActive: 1, createdAt: now, updatedAt: now })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'pay_method', entityId: id })

  return c.json(serializePayMethod({ id, ...data, isActive: 1 }, caller.role), 201)
})

payMethodsRoutes.put('/:id', requireRole('admin'), zValidator('json', bodySchema.partial()), async (c) => {
  const caller = c.get('user')
  const now = Date.now()
  await db.update(payMethods).set({ ...c.req.valid('json'), updatedAt: now }).where(eq(payMethods.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'pay_method', entityId: c.req.param('id') })
  const updated = await db.query.payMethods.findFirst({ where: eq(payMethods.id, c.req.param('id')) })
  return c.json(serializePayMethod(updated!, caller.role))
})

payMethodsRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const caller = c.get('user')
  const now = Date.now()
  await db.update(payMethods).set({ deletedAt: now, updatedAt: now }).where(eq(payMethods.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'pay_method', entityId: c.req.param('id') })
  return c.json({ ok: true })
})
```

- [ ] **Step 4: Correr tests**

```bash
npm test tests/routes/pay-methods.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/serializers/ src/routes/pay-methods.ts tests/routes/pay-methods.test.ts
git commit -m "feat: pay-methods CRUD + serializer that hides display_name from non-admin"
```

---

## Task 9: Services Routes

**Files:**
- Create: `thrall/src/routes/services.ts`
- Create: `thrall/tests/routes/services.test.ts`

**Interfaces:**
- Consumes: `db`, `services`, `serviceExtras` schema, `authMiddleware`, `requireRole`, `newId`, `logAudit`, `getTodayRangeInBogota`
- Produces:
  - `GET /services` → filtrado por rol y timezone Bogotá
  - `POST /services` → crea servicio con extras [admin, monitor]
  - `PUT /services/:id` → edita servicio [admin, monitor]
  - `DELETE /services/:id` → soft delete [admin, monitor]
  - `servicesRoutes: Hono`

- [ ] **Step 1: Escribir tests de services**

```ts
// tests/routes/services.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { servicesRoutes } from '../../src/routes/services'
import { createTestBrand, createTestUser, createTestPayMethod, createTestService, tokenFor } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/services', servicesRoutes)

let brandId: string
let adminId: string
let monitorId: string
let modelId: string
let adminToken: string
let monitorToken: string
let modelToken: string
let payMethodId: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `adm-sv-${Date.now()}@t.com` })
  const monitor = await createTestUser(brandId, { role: 'monitor', email: `mon-sv-${Date.now()}@t.com` })
  const model = await createTestUser(brandId, { role: 'model', email: `mod-sv-${Date.now()}@t.com` })
  adminId = admin.id; monitorId = monitor.id; modelId = model.id
  adminToken = await tokenFor(adminId, 'admin', brandId)
  monitorToken = await tokenFor(monitorId, 'monitor', brandId)
  modelToken = await tokenFor(modelId, 'model', brandId)
  payMethodId = await createTestPayMethod(brandId)
})

describe('POST /api/services', () => {
  it('monitor can create a service with extras', async () => {
    const now = Date.now()
    const res = await app.request('/api/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${monitorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId,
        startTime: now - 3600000,
        endTime: now,
        basePrice: 100000,
        payMethodId,
        note: 'Test',
        extras: [{ description: 'Baño', amount: 20000 }],
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBeDefined()
    expect(body.extras).toHaveLength(1)
  })

  it('model cannot create services', async () => {
    const res = await app.request('/api/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${modelToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, startTime: 0, endTime: 1, basePrice: 1000, payMethodId }),
    })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/services/:id', () => {
  it('monitor can soft delete a service', async () => {
    const serviceId = await createTestService(modelId, monitorId, payMethodId)
    const res = await app.request(`/api/services/${serviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(200)
  })
})

describe('GET /api/services', () => {
  it('model only sees own services', async () => {
    const model2 = await createTestUser(brandId, { role: 'model', email: `mod2-${Date.now()}@t.com` })
    await createTestService(modelId, adminId, payMethodId)
    await createTestService(model2.id, adminId, payMethodId)

    const res = await app.request('/api/services', {
      headers: { Authorization: `Bearer ${modelToken}` },
    })
    const body = await res.json() as any[]
    expect(body.every((s: any) => s.modelId === modelId)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr tests y confirmar que fallan**

```bash
npm test tests/routes/services.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Crear `src/routes/services.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, isNull, isNotNull } from 'drizzle-orm'
import { db } from '../db/client'
import { services, serviceExtras } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { getTodayRangeInBogota } from '../lib/timezone'

export const servicesRoutes = new Hono<AppEnv>()
servicesRoutes.use('*', authMiddleware)

const createSchema = z.object({
  modelId: z.string(),
  startTime: z.number().int(),
  endTime: z.number().int(),
  basePrice: z.number().int().positive(),
  payMethodId: z.string(),
  note: z.string().optional(),
  extras: z.array(z.object({
    description: z.string(),
    amount: z.number().int().positive(),
  })).default([]),
})

async function getServiceWithExtras(id: string) {
  const service = await db.query.services.findFirst({ where: eq(services.id, id) })
  if (!service) return null
  const extras = await db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, id) })
  return { ...service, extras }
}

servicesRoutes.get('/', async (c) => {
  const caller = c.get('user')
  const { start, end } = getTodayRangeInBogota()

  if (caller.role === 'admin') {
    const all = await db.query.services.findMany({
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    })
    const withExtras = await Promise.all(all.map((s) =>
      db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, s.id) })
        .then((extras) => ({ ...s, extras }))
    ))
    return c.json(withExtras)
  }

  if (caller.role === 'monitor') {
    const todayServices = await db.query.services.findMany({
      where: (s, { and, between, isNull }) =>
        and(between(s.startTime, start, end), isNull(s.deletedAt)),
      orderBy: (s, { desc }) => [desc(s.startTime)],
    })
    const withExtras = await Promise.all(todayServices.map((s) =>
      db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, s.id) })
        .then((extras) => ({ ...s, extras }))
    ))
    return c.json(withExtras)
  }

  // model — only own services today
  const ownServices = await db.query.services.findMany({
    where: (s, { and, eq: eqFn, between, isNull }) =>
      and(eqFn(s.modelId, caller.sub), between(s.startTime, start, end), isNull(s.deletedAt)),
    orderBy: (s, { desc }) => [desc(s.startTime)],
  })
  const withExtras = await Promise.all(ownServices.map((s) =>
    db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, s.id) })
      .then((extras) => ({ ...s, extras }))
  ))
  return c.json(withExtras)
})

servicesRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  if (!['admin', 'monitor'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const data = c.req.valid('json')
  const id = newId()
  const now = Date.now()

  await db.insert(services).values({
    id,
    modelId: data.modelId,
    createdBy: caller.sub,
    startTime: data.startTime,
    endTime: data.endTime,
    basePrice: data.basePrice,
    payMethodId: data.payMethodId,
    note: data.note ?? null,
    createdAt: now,
    updatedAt: now,
  })

  for (const extra of data.extras) {
    await db.insert(serviceExtras).values({
      id: newId(),
      serviceId: id,
      description: extra.description,
      amount: extra.amount,
      createdAt: now,
    })
  }

  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'service', entityId: id })

  const result = await getServiceWithExtras(id)
  return c.json(result, 201)
})

servicesRoutes.put('/:id', zValidator('json', createSchema.partial()), async (c) => {
  const caller = c.get('user')
  if (!['admin', 'monitor'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const data = c.req.valid('json')
  const now = Date.now()
  const { extras, ...serviceData } = data

  await db.update(services).set({ ...serviceData, updatedAt: now }).where(eq(services.id, c.req.param('id')))

  if (extras !== undefined) {
    await db.delete(serviceExtras).where(eq(serviceExtras.serviceId, c.req.param('id')))
    for (const extra of extras) {
      await db.insert(serviceExtras).values({
        id: newId(),
        serviceId: c.req.param('id'),
        description: extra.description,
        amount: extra.amount,
        createdAt: now,
      })
    }
  }

  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'service', entityId: c.req.param('id') })
  return c.json(await getServiceWithExtras(c.req.param('id')))
})

servicesRoutes.delete('/:id', async (c) => {
  const caller = c.get('user')
  if (!['admin', 'monitor'].includes(caller.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const now = Date.now()
  await db.update(services).set({ deletedAt: now, updatedAt: now }).where(eq(services.id, c.req.param('id')))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'service', entityId: c.req.param('id') })
  return c.json({ ok: true })
})
```

- [ ] **Step 4: Correr tests y confirmar que pasan**

```bash
npm test tests/routes/services.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/services.ts tests/routes/services.test.ts
git commit -m "feat: services CRUD with extras, role-scoped GET, soft delete"
```

---

## Task 10: Reports Routes

**Files:**
- Create: `thrall/src/routes/reports.ts`
- Create: `thrall/tests/routes/reports.test.ts`

**Interfaces:**
- Consumes: `db`, `services`, `serviceExtras`, `users` schema, `authMiddleware`, `requireRole`, `calcEarnings`, `getTodayRangeInBogota`
- Produces:
  - `GET /reports/earnings?from=&to=` → [admin] ganancias empresa en rango
  - `GET /reports/model-earnings/:id?from=&to=` → [admin] ganancias de una modelo
  - `GET /reports/daily` → [admin, monitor] resumen del día
  - `GET /reports/ranking` → [todos] top modelos por cantidad de servicios
  - `reportsRoutes: Hono`

- [ ] **Step 1: Escribir tests de reports**

```ts
// tests/routes/reports.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { reportsRoutes } from '../../src/routes/reports'
import { createTestBrand, createTestUser, createTestPayMethod, createTestService, tokenFor } from '../helpers'

const app = new Hono().basePath('/api')
app.route('/reports', reportsRoutes)

let brandId: string
let adminToken: string
let monitorToken: string
let modelToken: string
let modelId: string
let adminId: string

beforeEach(async () => {
  brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin', email: `adm-rp-${Date.now()}@t.com` })
  const monitor = await createTestUser(brandId, { role: 'monitor', email: `mon-rp-${Date.now()}@t.com` })
  const model = await createTestUser(brandId, { role: 'model', email: `mod-rp-${Date.now()}@t.com` })
  adminId = admin.id; modelId = model.id
  adminToken = await tokenFor(adminId, 'admin', brandId)
  monitorToken = await tokenFor(monitor.id, 'monitor', brandId)
  modelToken = await tokenFor(model.id, 'model', brandId)
})

describe('GET /api/reports/ranking', () => {
  it('returns ranking for all roles', async () => {
    const pm = await createTestPayMethod(brandId)
    await createTestService(modelId, adminId, pm)

    for (const token of [adminToken, monitorToken, modelToken]) {
      const res = await app.request('/api/reports/ranking', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any[]
      expect(Array.isArray(body)).toBe(true)
    }
  })
})

describe('GET /api/reports/earnings', () => {
  it('returns earnings summary for admin', async () => {
    const pm = await createTestPayMethod(brandId)
    await createTestService(modelId, adminId, pm, [20000])

    const from = Date.now() - 86400000
    const to = Date.now() + 86400000
    const res = await app.request(`/api/reports/earnings?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.totalServices).toBeGreaterThan(0)
    expect(body.companyEarnings).toBeGreaterThan(0)
  })

  it('returns 403 for monitor', async () => {
    const res = await app.request('/api/reports/earnings?from=0&to=9999999999999', {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/reports/daily', () => {
  it('returns daily summary for monitor', async () => {
    const res = await app.request('/api/reports/daily', {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(200)
  })

  it('returns 403 for model', async () => {
    const res = await app.request('/api/reports/daily', {
      headers: { Authorization: `Bearer ${modelToken}` },
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Crear `src/routes/reports.ts`**

```ts
import { Hono } from 'hono'
import { eq, and, between, isNull, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { services, serviceExtras, users } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { calcEarnings } from '../lib/earnings'
import { getTodayRangeInBogota } from '../lib/timezone'

export const reportsRoutes = new Hono<AppEnv>()
reportsRoutes.use('*', authMiddleware)

reportsRoutes.get('/ranking', async (c) => {
  const all = await db.query.services.findMany({
    where: (s, { isNull }) => isNull(s.deletedAt),
  })

  const countByModel: Record<string, { modelId: string; count: number; totalBase: number }> = {}
  for (const s of all) {
    if (!countByModel[s.modelId]) {
      countByModel[s.modelId] = { modelId: s.modelId, count: 0, totalBase: 0 }
    }
    countByModel[s.modelId].count++
    countByModel[s.modelId].totalBase += s.basePrice
  }

  const ranked = await Promise.all(
    Object.values(countByModel)
      .sort((a, b) => b.count - a.count)
      .map(async (entry, i) => {
        const model = await db.query.users.findFirst({ where: eq(users.id, entry.modelId) })
        return {
          position: i + 1,
          modelId: entry.modelId,
          name: model?.name ?? 'Unknown',
          serviceCount: entry.count,
          totalBase: entry.totalBase,
        }
      })
  )

  return c.json(ranked)
})

reportsRoutes.get('/earnings', requireRole('admin'), async (c) => {
  const from = Number(c.req.query('from') ?? 0)
  const to = Number(c.req.query('to') ?? Date.now())

  const allServices = await db.query.services.findMany({
    where: (s, { and, between, isNull }) =>
      and(between(s.startTime, from, to), isNull(s.deletedAt)),
  })

  let totalBase = 0
  let companyEarnings = 0
  let modelBaseEarnings = 0
  let modelExtraEarnings = 0

  for (const s of allServices) {
    const extras = await db.query.serviceExtras.findMany({
      where: eq(serviceExtras.serviceId, s.id),
    })
    const e = calcEarnings(s.basePrice, extras.map((x) => x.amount))
    totalBase += s.basePrice
    companyEarnings += e.company
    modelBaseEarnings += e.modelBase
    modelExtraEarnings += e.modelExtras
  }

  return c.json({
    totalServices: allServices.length,
    totalBase,
    companyEarnings,
    modelBaseEarnings,
    modelExtraEarnings,
    modelTotalEarnings: modelBaseEarnings + modelExtraEarnings,
  })
})

reportsRoutes.get('/model-earnings/:id', requireRole('admin'), async (c) => {
  const modelId = c.req.param('id')
  const from = Number(c.req.query('from') ?? 0)
  const to = Number(c.req.query('to') ?? Date.now())

  const modelServices = await db.query.services.findMany({
    where: (s, { and, eq: eqFn, between, isNull }) =>
      and(eqFn(s.modelId, modelId), between(s.startTime, from, to), isNull(s.deletedAt)),
    orderBy: (s, { desc }) => [desc(s.startTime)],
  })

  const rows = await Promise.all(
    modelServices.map(async (s) => {
      const extras = await db.query.serviceExtras.findMany({
        where: eq(serviceExtras.serviceId, s.id),
      })
      const e = calcEarnings(s.basePrice, extras.map((x) => x.amount))
      return {
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        basePrice: s.basePrice,
        extras: extras.map((x) => ({ description: x.description, amount: x.amount })),
        modelBase: e.modelBase,
        modelExtras: e.modelExtras,
        modelTotal: e.modelTotal,
      }
    })
  )

  const totals = rows.reduce(
    (acc, r) => ({
      totalBase: acc.totalBase + r.basePrice,
      totalModelEarnings: acc.totalModelEarnings + r.modelTotal,
    }),
    { totalBase: 0, totalModelEarnings: 0 }
  )

  return c.json({ rows, totals })
})

reportsRoutes.get('/daily', requireRole('admin', 'monitor'), async (c) => {
  const { start, end } = getTodayRangeInBogota()

  const todayServices = await db.query.services.findMany({
    where: (s, { and, between, isNull }) =>
      and(between(s.startTime, start, end), isNull(s.deletedAt)),
  })

  let totalBase = 0
  let companyEarnings = 0
  let modelEarnings = 0

  for (const s of todayServices) {
    const extras = await db.query.serviceExtras.findMany({
      where: eq(serviceExtras.serviceId, s.id),
    })
    const e = calcEarnings(s.basePrice, extras.map((x) => x.amount))
    totalBase += s.basePrice
    companyEarnings += e.company
    modelEarnings += e.modelTotal
  }

  return c.json({
    date: new Date(start).toISOString().slice(0, 10),
    totalServices: todayServices.length,
    totalBase,
    companyEarnings,
    modelEarnings,
  })
})
```

- [ ] **Step 3: Correr tests y confirmar que pasan**

```bash
npm test tests/routes/reports.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 4: Correr suite completa**

```bash
npm test
```

Expected: PASS (todos los tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/reports.ts tests/routes/reports.test.ts
git commit -m "feat: reports routes (earnings, model-earnings, daily, ranking)"
```

---

## Task 11: App Assembly + Vercel Entry + Seed Script

**Files:**
- Create: `thrall/src/app.ts`
- Create: `thrall/api/index.ts`
- Create: `thrall/scripts/seed.ts`

**Interfaces:**
- Consumes: todos los routers de `src/routes/`
- Produces: app Hono deployable en Vercel, script de seed ejecutable con `npm run seed`

- [ ] **Step 1: Crear `src/app.ts`**

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes } from './routes/auth'
import { usersRoutes } from './routes/users'
import { modelsRoutes } from './routes/models'
import { imagesRoutes } from './routes/images'
import { payMethodsRoutes } from './routes/pay-methods'
import { servicesRoutes } from './routes/services'
import { reportsRoutes } from './routes/reports'

const app = new Hono().basePath('/api')

app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

app.route('/auth', authRoutes)
app.route('/users', usersRoutes)
app.route('/models', modelsRoutes)
app.route('/images', imagesRoutes)
app.route('/pay-methods', payMethodsRoutes)
app.route('/services', servicesRoutes)
app.route('/reports', reportsRoutes)

app.get('/health', (c) => c.json({ ok: true }))

export default app
```

- [ ] **Step 2: Crear `api/index.ts`**

```ts
import { handle } from 'hono/vercel'
import app from '../src/app'

export const config = { runtime: 'nodejs' }
export default handle(app)
```

- [ ] **Step 3: Crear `scripts/seed.ts`**

```ts
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
```

- [ ] **Step 4: Correr suite completa para confirmar nada roto**

```bash
npm test
```

Expected: PASS (todos)

- [ ] **Step 5: Generar migración final y verificar**

```bash
npm run db:generate
```

- [ ] **Step 6: Commit final**

```bash
git add src/app.ts api/index.ts scripts/seed.ts migrations/
git commit -m "feat: assemble Hono app, Vercel entry, and seed script"
```

---

## Deploy Checklist

Antes de hacer deploy a Vercel:

- [ ] Crear base de datos en Turso: `turso db create arthas`
- [ ] Obtener URL y token: `turso db show arthas` / `turso db tokens create arthas`
- [ ] Crear Vercel project apuntando a `thrall/`
- [ ] Agregar env vars en Vercel: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`, `FRONTEND_URL`
- [ ] Ejecutar migraciones contra Turso: `npm run db:migrate`
- [ ] Ejecutar seed: `npm run seed`
- [ ] Verificar `GET /api/health` retorna `{ ok: true }`
- [ ] Verificar `POST /api/auth/login` con credenciales del seed

---

*Siguiente plan: `2026-06-23-sylvanas-frontend.md` — Next.js landing page + dashboard completo*
