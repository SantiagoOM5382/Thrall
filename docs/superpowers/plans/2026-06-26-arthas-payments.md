# Arthas Payments (Fines, Loans, Settlements) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-model fines, loans, and admin settlements (payments) on top of a calculated running balance, across the thrall backend and sylvanas frontend.

**Architecture:** Three new SQLite tables (`fines`, `loans`, `payments`). Balance is never persisted — computed on read as `Σ service earnings − Σ fines − Σ loans − Σ payments`. New Hono routes mirror the existing `services.ts` role-scoping and timezone patterns. Frontend adds inline fine/loan registration to the daily panel, a balance + settlement section to the admin model-detail page, and the model's own daily fines/loans to their profile.

**Tech Stack:** Hono + Drizzle ORM + Turso (thrall); Next.js 15 App Router + shadcn/ui (sylvanas).

## Global Constraints

- IDs are ULID via `newId()`; amounts are INTEGER (Colombian pesos); timestamps are INTEGER unix ms via `Date.now()`.
- Soft delete via `deleted_at INTEGER NULL` on `fines` and `loans`. `payments` has NO `deleted_at` — payments are immutable.
- `getServiceEarning(basePrice, extras)` = `Math.round(basePrice * 0.6) + Σ extras.amount`. Reuse `calcEarnings` from `src/lib/earnings.ts` (returns `{ modelBase, company, modelExtras, modelTotal }`; use `modelTotal`).
- "Today" is `America/Bogota` via `getTodayRangeInBogota()` (returns `{ start, end }`). Fines/loans scope on `created_at`.
- Permissions: create fine [admin, monitor]; delete fine [admin]; create loan [admin, monitor]; delete loan [admin, monitor]; create payment [admin]; view balance & payment history [admin]. GET fines/loans is role-scoped: admin=all (incl. soft-deleted), monitor=today active, model=own today active.
- Every CREATE/DELETE mutation calls `logAudit(db, { userId, action, entity, entityId })` with entity `'fine' | 'loan' | 'payment'`.
- All new routes mount under `authMiddleware`. After any thrall `src/` change, run `npm run build` (tsup → `dist/index.mjs`) and commit the bundle (see memory `thrall-vercel-deploy`).
- Test helpers in `tests/helpers.ts`: `createTestBrand()`, `createTestUser(brandId, { role, email, name })`, `tokenFor(userId, role, brandId)`, `createTestPayMethod()`, `createTestService(modelId, createdBy, payMethodId, extraAmounts[])` (basePrice is fixed 100000). Tests run with `npm test` (vitest, in-memory DB, migrations auto-applied in `tests/setup.ts`).
- sylvanas: verify with `node_modules/.bin/tsc --noEmit` (NOT `npx tsc` — it flakily fetches a fake pkg) and `npm run build`. shadcn Button/Dialog are base-ui (use `render` prop, not `asChild`; for links use `buttonVariants()` on `<a>`). Server Actions return `{ error?: string }` and call `revalidatePath`. apiFetch is the authed server-side wrapper; types live in `lib/types.ts`.

---

## Task 1: Database schema + migration

**Files:**
- Modify: `thrall/src/db/schema.ts` (append three tables)
- Create: migration via `npm run db:generate`

**Interfaces:**
- Produces: Drizzle tables `fines`, `loans`, `payments` exported from `src/db/schema.ts`.

- [ ] **Step 1: Append the three tables to `thrall/src/db/schema.ts`**

```ts
export const fines = sqliteTable('fines', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const loans = sqliteTable('loans', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  payMethodId: text('pay_method_id').notNull().references(() => payMethods.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
})
```

- [ ] **Step 2: Generate the migration**

Run: `cd thrall && npm run db:generate`
Expected: a new file under `thrall/migrations/` with three `CREATE TABLE` statements; no errors.

- [ ] **Step 3: Verify tests still pass (migration applies in-memory)**

Run: `cd thrall && npm test`
Expected: existing suite passes (setup.ts applies the new migration cleanly).

- [ ] **Step 4: Commit**

```bash
git add thrall/src/db/schema.ts thrall/migrations/
git commit -m "feat(thrall): fines, loans, payments tables + migration"
```

---

## Task 2: Fines routes (POST / GET / DELETE)

**Files:**
- Create: `thrall/src/routes/fines.ts`
- Create: `thrall/tests/routes/fines.test.ts`

**Interfaces:**
- Consumes: `db`, `fines` table, `authMiddleware`/`AppEnv`, `requireRole`, `newId`, `logAudit`, `getTodayRangeInBogota`.
- Produces: `export const finesRoutes` (Hono app) — mounted at `/fines` in Task 6.

- [ ] **Step 1: Write the failing test** in `thrall/tests/routes/fines.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function setup() {
  const brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin' })
  const monitor = await createTestUser(brandId, { role: 'monitor' })
  const model = await createTestUser(brandId, { role: 'model' })
  return {
    brandId,
    adminToken: await tokenFor(admin.id, 'admin', brandId),
    monitorToken: await tokenFor(monitor.id, 'monitor', brandId),
    modelToken: await tokenFor(model.id, 'model', brandId),
    modelId: model.id,
  }
}

describe('fines routes', () => {
  it('monitor can create a fine', async () => {
    const { monitorToken, modelId } = await setup()
    const res = await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 5000, reason: 'Llegó tarde' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.amount).toBe(5000)
    expect(body.modelId).toBe(modelId)
  })

  it('rejects non-positive amount', async () => {
    const { monitorToken, modelId } = await setup()
    const res = await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 0, reason: 'x' }),
    })
    expect(res.status).toBe(400)
  })

  it('monitor CANNOT delete a fine, admin CAN', async () => {
    const { adminToken, monitorToken, modelId } = await setup()
    const created = await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 3000, reason: 'x' }),
    })
    const { id } = await created.json()

    const denied = await app.request(`/api/fines/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(denied.status).toBe(403)

    const ok = await app.request(`/api/fines/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(ok.status).toBe(200)
  })

  it('model sees only own fines from today', async () => {
    const { adminToken, modelToken, modelId } = await setup()
    await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 1000, reason: 'x' }),
    })
    const res = await app.request('/api/fines', {
      headers: { Authorization: `Bearer ${modelToken}` },
    })
    expect(res.status).toBe(200)
    const list = await res.json()
    expect(list).toHaveLength(1)
    expect(list[0].modelId).toBe(modelId)
  })

  it('delete returns 404 for missing fine', async () => {
    const { adminToken } = await setup()
    const res = await app.request('/api/fines/nonexistent', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- fines`
Expected: FAIL (route not mounted / module missing).

- [ ] **Step 3: Create `thrall/src/routes/fines.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { fines, users } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { getTodayRangeInBogota } from '../lib/timezone'

export const finesRoutes = new Hono<AppEnv>()
finesRoutes.use('*', authMiddleware)

const createSchema = z.object({
  modelId: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().min(1),
})

finesRoutes.get('/', async (c) => {
  const caller = c.get('user')

  if (caller.role === 'admin') {
    const all = await db.query.fines.findMany({
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    })
    return c.json(all)
  }

  const { start, end } = getTodayRangeInBogota()
  if (caller.role === 'monitor') {
    const today = await db.query.fines.findMany({
      where: (f, { and, between, isNull }) =>
        and(between(f.createdAt, start, end), isNull(f.deletedAt)),
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    })
    return c.json(today)
  }

  // model — own fines today
  const own = await db.query.fines.findMany({
    where: (f, { and, eq: eqFn, between, isNull }) =>
      and(eqFn(f.modelId, caller.sub), between(f.createdAt, start, end), isNull(f.deletedAt)),
    orderBy: (f, { desc }) => [desc(f.createdAt)],
  })
  return c.json(own)
})

finesRoutes.post('/', requireRole('admin', 'monitor'), zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')

  const model = await db.query.users.findFirst({
    where: (u, { and, eq: eqFn, isNull }) =>
      and(eqFn(u.id, data.modelId), eqFn(u.role, 'model'), isNull(u.deletedAt)),
  })
  if (!model) return c.json({ error: 'Model not found' }, 404)

  const id = newId()
  const now = Date.now()
  await db.insert(fines).values({
    id, modelId: data.modelId, amount: data.amount, reason: data.reason,
    createdBy: caller.sub, createdAt: now,
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'fine', entityId: id })

  const created = await db.query.fines.findFirst({ where: eq(fines.id, id) })
  return c.json(created, 201)
})

finesRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')

  const existing = await db.query.fines.findFirst({
    where: (f, { and, eq: eqFn, isNull }) => and(eqFn(f.id, id), isNull(f.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.update(fines).set({ deletedAt: Date.now() }).where(eq(fines.id, id))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'fine', entityId: id })
  return c.json({ ok: true })
})
```

- [ ] **Step 4: Mount the route temporarily to run tests** — in `thrall/src/app.ts`, add `import { finesRoutes } from './routes/fines'` and `app.route('/fines', finesRoutes)` (this line is also part of Task 6; adding it now lets the test pass).

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd thrall && npm test -- fines`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add thrall/src/routes/fines.ts thrall/tests/routes/fines.test.ts thrall/src/app.ts
git commit -m "feat(thrall): fines routes (create/list role-scoped/delete admin-only)"
```

---

## Task 3: Loans routes (POST / GET / DELETE)

**Files:**
- Create: `thrall/src/routes/loans.ts`
- Create: `thrall/tests/routes/loans.test.ts`

**Interfaces:**
- Produces: `export const loansRoutes` — mounted at `/loans` in Task 6.

- [ ] **Step 1: Write the failing test** in `thrall/tests/routes/loans.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function setup() {
  const brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin' })
  const monitor = await createTestUser(brandId, { role: 'monitor' })
  const model = await createTestUser(brandId, { role: 'model' })
  return {
    adminToken: await tokenFor(admin.id, 'admin', brandId),
    monitorToken: await tokenFor(monitor.id, 'monitor', brandId),
    modelToken: await tokenFor(model.id, 'model', brandId),
    modelId: model.id,
  }
}

describe('loans routes', () => {
  it('monitor can create a loan', async () => {
    const { monitorToken, modelId } = await setup()
    const res = await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 50000, reason: 'Adelanto' }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).amount).toBe(50000)
  })

  it('monitor CAN delete a loan (with record)', async () => {
    const { monitorToken, modelId } = await setup()
    const created = await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 20000, reason: 'x' }),
    })
    const { id } = await created.json()
    const del = await app.request(`/api/loans/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(del.status).toBe(200)
  })

  it('model sees only own loans from today', async () => {
    const { adminToken, modelToken, modelId } = await setup()
    await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 10000, reason: 'x' }),
    })
    const res = await app.request('/api/loans', { headers: { Authorization: `Bearer ${modelToken}` } })
    expect((await res.json())).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- loans`
Expected: FAIL.

- [ ] **Step 3: Create `thrall/src/routes/loans.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { loans } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'
import { getTodayRangeInBogota } from '../lib/timezone'

export const loansRoutes = new Hono<AppEnv>()
loansRoutes.use('*', authMiddleware)

const createSchema = z.object({
  modelId: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().min(1),
})

loansRoutes.get('/', async (c) => {
  const caller = c.get('user')

  if (caller.role === 'admin') {
    const all = await db.query.loans.findMany({
      orderBy: (l, { desc }) => [desc(l.createdAt)],
    })
    return c.json(all)
  }

  const { start, end } = getTodayRangeInBogota()
  if (caller.role === 'monitor') {
    const today = await db.query.loans.findMany({
      where: (l, { and, between, isNull }) =>
        and(between(l.createdAt, start, end), isNull(l.deletedAt)),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
    })
    return c.json(today)
  }

  const own = await db.query.loans.findMany({
    where: (l, { and, eq: eqFn, between, isNull }) =>
      and(eqFn(l.modelId, caller.sub), between(l.createdAt, start, end), isNull(l.deletedAt)),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  })
  return c.json(own)
})

loansRoutes.post('/', requireRole('admin', 'monitor'), zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')

  const model = await db.query.users.findFirst({
    where: (u, { and, eq: eqFn, isNull }) =>
      and(eqFn(u.id, data.modelId), eqFn(u.role, 'model'), isNull(u.deletedAt)),
  })
  if (!model) return c.json({ error: 'Model not found' }, 404)

  const id = newId()
  const now = Date.now()
  await db.insert(loans).values({
    id, modelId: data.modelId, amount: data.amount, reason: data.reason,
    createdBy: caller.sub, createdAt: now,
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'loan', entityId: id })

  const created = await db.query.loans.findFirst({ where: eq(loans.id, id) })
  return c.json(created, 201)
})

loansRoutes.delete('/:id', requireRole('admin', 'monitor'), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')

  const existing = await db.query.loans.findFirst({
    where: (l, { and, eq: eqFn, isNull }) => and(eqFn(l.id, id), isNull(l.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.update(loans).set({ deletedAt: Date.now() }).where(eq(loans.id, id))
  await logAudit(db, { userId: caller.sub, action: 'DELETE', entity: 'loan', entityId: id })
  return c.json({ ok: true })
})
```

- [ ] **Step 4: Mount the route** — in `thrall/src/app.ts`, add `import { loansRoutes } from './routes/loans'` and `app.route('/loans', loansRoutes)`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd thrall && npm test -- loans`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add thrall/src/routes/loans.ts thrall/tests/routes/loans.test.ts thrall/src/app.ts
git commit -m "feat(thrall): loans routes (create/list role-scoped/delete admin+monitor)"
```

---

## Task 4: Payments routes (POST / GET)

**Files:**
- Create: `thrall/src/routes/payments.ts`
- Create: `thrall/tests/routes/payments.test.ts`

**Interfaces:**
- Produces: `export const paymentsRoutes` — mounted at `/payments` in Task 6.

- [ ] **Step 1: Write the failing test** in `thrall/tests/routes/payments.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor, createTestPayMethod } from '../helpers'

async function setup() {
  const brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin' })
  const monitor = await createTestUser(brandId, { role: 'monitor' })
  const model = await createTestUser(brandId, { role: 'model' })
  return {
    adminToken: await tokenFor(admin.id, 'admin', brandId),
    monitorToken: await tokenFor(monitor.id, 'monitor', brandId),
    modelId: model.id,
    payMethodId: await createTestPayMethod(),
  }
}

describe('payments routes', () => {
  it('admin can create a payment', async () => {
    const { adminToken, modelId, payMethodId } = await setup()
    const res = await app.request('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 120000, payMethodId }),
    })
    expect(res.status).toBe(201)
    expect((await res.json()).amount).toBe(120000)
  })

  it('monitor CANNOT create a payment', async () => {
    const { monitorToken, modelId, payMethodId } = await setup()
    const res = await app.request('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ modelId, amount: 1000, payMethodId }),
    })
    expect(res.status).toBe(403)
  })

  it('admin lists payments for a model', async () => {
    const { adminToken, modelId, payMethodId } = await setup()
    await app.request('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId, amount: 5000, payMethodId }),
    })
    const res = await app.request(`/api/payments?modelId=${modelId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    expect((await res.json())).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- payments`
Expected: FAIL.

- [ ] **Step 3: Create `thrall/src/routes/payments.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { payments } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'

export const paymentsRoutes = new Hono<AppEnv>()
paymentsRoutes.use('*', authMiddleware, requireRole('admin'))

const createSchema = z.object({
  modelId: z.string(),
  amount: z.number().int().positive(),
  payMethodId: z.string(),
})

paymentsRoutes.get('/', async (c) => {
  const modelId = c.req.query('modelId')
  if (!modelId) return c.json({ error: 'modelId is required' }, 400)
  const list = await db.query.payments.findMany({
    where: (p, { eq: eqFn }) => eqFn(p.modelId, modelId),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })
  return c.json(list)
})

paymentsRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const data = c.req.valid('json')

  const model = await db.query.users.findFirst({
    where: (u, { and, eq: eqFn, isNull }) =>
      and(eqFn(u.id, data.modelId), eqFn(u.role, 'model'), isNull(u.deletedAt)),
  })
  if (!model) return c.json({ error: 'Model not found' }, 404)

  const id = newId()
  await db.insert(payments).values({
    id, modelId: data.modelId, amount: data.amount,
    payMethodId: data.payMethodId, createdBy: caller.sub, createdAt: Date.now(),
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'payment', entityId: id })

  const created = await db.query.payments.findFirst({ where: eq(payments.id, id) })
  return c.json(created, 201)
})
```

- [ ] **Step 4: Mount the route** — in `thrall/src/app.ts`, add `import { paymentsRoutes } from './routes/payments'` and `app.route('/payments', paymentsRoutes)`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd thrall && npm test -- payments`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add thrall/src/routes/payments.ts thrall/tests/routes/payments.test.ts thrall/src/app.ts
git commit -m "feat(thrall): payments routes (create + list, admin-only, immutable)"
```

---

## Task 5: Model balance report endpoint

**Files:**
- Modify: `thrall/src/routes/reports.ts` (add one handler)
- Create: `thrall/tests/routes/model-balance.test.ts`

**Interfaces:**
- Consumes: `calcEarnings` from `src/lib/earnings.ts`; `fines`, `loans`, `payments`, `services`, `serviceExtras` tables.
- Produces: `GET /api/reports/model-balance/:id` → `{ balance, totalEarnings, totalFines, totalLoans, totalPayments }` (admin only).

- [ ] **Step 1: Write the failing test** in `thrall/tests/routes/model-balance.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import {
  createTestBrand, createTestUser, tokenFor, createTestPayMethod, createTestService,
} from '../helpers'

describe('model-balance report', () => {
  it('computes balance = earnings - fines - loans - payments', async () => {
    const brandId = await createTestBrand()
    const admin = await createTestUser(brandId, { role: 'admin' })
    const model = await createTestUser(brandId, { role: 'model' })
    const adminToken = await tokenFor(admin.id, 'admin', brandId)
    const payMethodId = await createTestPayMethod()

    // One service: basePrice 100000, extras [20000] → modelTotal = 60000 + 20000 = 80000
    await createTestService(model.id, admin.id, payMethodId, [20000])

    // Fine 5000, loan 30000, payment 10000
    await app.request('/api/fines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId: model.id, amount: 5000, reason: 'x' }),
    })
    await app.request('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId: model.id, amount: 30000, reason: 'x' }),
    })
    await app.request('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ modelId: model.id, amount: 10000, payMethodId }),
    })

    const res = await app.request(`/api/reports/model-balance/${model.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const b = await res.json()
    expect(b.totalEarnings).toBe(80000)
    expect(b.totalFines).toBe(5000)
    expect(b.totalLoans).toBe(30000)
    expect(b.totalPayments).toBe(10000)
    expect(b.balance).toBe(80000 - 5000 - 30000 - 10000) // 35000
  })

  it('is admin-only', async () => {
    const brandId = await createTestBrand()
    const monitor = await createTestUser(brandId, { role: 'monitor' })
    const model = await createTestUser(brandId, { role: 'model' })
    const monitorToken = await tokenFor(monitor.id, 'monitor', brandId)
    const res = await app.request(`/api/reports/model-balance/${model.id}`, {
      headers: { Authorization: `Bearer ${monitorToken}` },
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- model-balance`
Expected: FAIL (404, route missing).

- [ ] **Step 3: Add the handler to `thrall/src/routes/reports.ts`**

Add these imports at the top (extend the existing import from schema):
```ts
import { services, serviceExtras, users, fines, loans, payments } from '../db/schema'
```

Add this handler (after the existing `/model-earnings/:id` route):
```ts
reportsRoutes.get('/model-balance/:id', requireRole('admin'), async (c) => {
  const modelId = c.req.param('id')!

  const modelServices = await db.query.services.findMany({
    where: (s, { and, eq: eqFn, isNull }) => and(eqFn(s.modelId, modelId), isNull(s.deletedAt)),
  })
  let totalEarnings = 0
  for (const s of modelServices) {
    const extras = await db.query.serviceExtras.findMany({
      where: eq(serviceExtras.serviceId, s.id),
    })
    totalEarnings += calcEarnings(s.basePrice, extras.map((x) => x.amount)).modelTotal
  }

  const modelFines = await db.query.fines.findMany({
    where: (f, { and, eq: eqFn, isNull }) => and(eqFn(f.modelId, modelId), isNull(f.deletedAt)),
  })
  const totalFines = modelFines.reduce((sum, f) => sum + f.amount, 0)

  const modelLoans = await db.query.loans.findMany({
    where: (l, { and, eq: eqFn, isNull }) => and(eqFn(l.modelId, modelId), isNull(l.deletedAt)),
  })
  const totalLoans = modelLoans.reduce((sum, l) => sum + l.amount, 0)

  const modelPayments = await db.query.payments.findMany({
    where: (p, { eq: eqFn }) => eqFn(p.modelId, modelId),
  })
  const totalPayments = modelPayments.reduce((sum, p) => sum + p.amount, 0)

  return c.json({
    balance: totalEarnings - totalFines - totalLoans - totalPayments,
    totalEarnings,
    totalFines,
    totalLoans,
    totalPayments,
  })
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd thrall && npm test -- model-balance`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add thrall/src/routes/reports.ts thrall/tests/routes/model-balance.test.ts
git commit -m "feat(thrall): model-balance report endpoint (admin)"
```

---

## Task 6: Verify full suite, rebuild bundle, deploy-ready

**Files:**
- Verify: `thrall/src/app.ts` (all three routes mounted from Tasks 2-4)
- Modify: `thrall/dist/index.mjs` (rebuilt)

- [ ] **Step 1: Confirm `app.ts` mounts all three new routes**

`thrall/src/app.ts` should contain (added across Tasks 2-4):
```ts
import { finesRoutes } from './routes/fines'
import { loansRoutes } from './routes/loans'
import { paymentsRoutes } from './routes/payments'
// ...
app.route('/fines', finesRoutes)
app.route('/loans', loansRoutes)
app.route('/payments', paymentsRoutes)
```

- [ ] **Step 2: Run the full suite + typecheck**

Run: `cd thrall && npm test && npx tsc --noEmit`
Expected: all tests pass; 0 type errors.

- [ ] **Step 3: Rebuild the deployment bundle**

Run: `cd thrall && npm run build`
Expected: `dist/index.mjs` rebuilt, no errors.

- [ ] **Step 4: Commit the bundle**

```bash
git add thrall/dist/index.mjs
git commit -m "build(thrall): rebuild bundle with fines/loans/payments routes"
```

> After merge, `git push` triggers Vercel redeploy. Then run the migration against
> production Turso: `cd thrall && npm run db:migrate` (uses `thrall/.env`).

---

## Task 7: Frontend — daily panel fines/loans (sylvanas)

**Files:**
- Create: `sylvanas/app/dashboard/services/fine-loan-actions.ts`
- Create: `sylvanas/app/dashboard/services/register-movement-dialog.tsx`
- Create: `sylvanas/app/dashboard/services/delete-movement-button.tsx`
- Modify: `sylvanas/app/dashboard/services/page.tsx`
- Modify: `sylvanas/lib/types.ts`

**Interfaces:**
- Consumes: `apiFetch`, `Model`, `formatCOP`, `formatBogotaDate`, `useSession`.
- Produces: `Fine`, `Loan` types; `createFine`, `createLoan`, `deleteFine`, `deleteLoan` server actions.

- [ ] **Step 1: Add types to `sylvanas/lib/types.ts`**

```ts
export interface Fine {
  id: string
  modelId: string
  amount: number
  reason: string
  createdBy: string
  createdAt: number
  deletedAt: number | null
}

export type Loan = Fine // identical shape
```

- [ ] **Step 2: Create server actions `sylvanas/app/dashboard/services/fine-loan-actions.ts`**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export interface MovementInput {
  modelId: string
  amount: number
  reason: string
}

export async function createFine(data: MovementInput): Promise<{ error?: string }> {
  try {
    await apiFetch("/fines", { method: "POST", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear multa" }
  }
  revalidatePath("/dashboard/services")
  return {}
}

export async function createLoan(data: MovementInput): Promise<{ error?: string }> {
  try {
    await apiFetch("/loans", { method: "POST", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear préstamo" }
  }
  revalidatePath("/dashboard/services")
  return {}
}

export async function deleteFine(id: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/fines/${id}`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar" }
  }
  revalidatePath("/dashboard/services")
  return {}
}

export async function deleteLoan(id: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/loans/${id}`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar" }
  }
  revalidatePath("/dashboard/services")
  return {}
}
```

- [ ] **Step 3: Create `sylvanas/app/dashboard/services/register-movement-dialog.tsx`**

```tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createFine, createLoan } from "./fine-loan-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  modelId: z.string().min(1, "Selecciona una modelo"),
  amount: z.coerce.number().int().positive("Monto inválido"),
  reason: z.string().min(1, "Motivo requerido"),
})
type FormValues = z.input<typeof schema>

export function RegisterMovementDialog({
  kind,
  models,
}: {
  kind: "fine" | "loan"
  models: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const label = kind === "fine" ? "Nueva multa" : "Nuevo préstamo"

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const payload = {
        modelId: values.modelId,
        amount: Number(values.amount),
        reason: values.reason,
      }
      const res = kind === "fine" ? await createFine(payload) : await createLoan(payload)
      if (res.error) { toast.error(res.error); return }
      toast.success(kind === "fine" ? "Multa registrada" : "Préstamo registrado")
      setOpen(false)
      reset({ modelId: "", amount: 0, reason: "" } as FormValues)
    })
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="mv-model">Modelo</Label>
            <select id="mv-model" className={selectClass} {...register("modelId")}>
              <option value="">Selecciona…</option>
              {models.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
            {errors.modelId && <p className="text-sm text-destructive">{errors.modelId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-amount">Monto (COP)</Label>
            <Input id="mv-amount" type="number" min={1} step={1} {...register("amount")} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-reason">Motivo</Label>
            <Input id="mv-reason" {...register("reason")} />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Create `sylvanas/app/dashboard/services/delete-movement-button.tsx`**

```tsx
"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { deleteFine, deleteLoan } from "./fine-loan-actions"
import { Button } from "@/components/ui/button"

export function DeleteMovementButton({
  kind,
  id,
}: {
  kind: "fine" | "loan"
  id: string
}) {
  const [isPending, startTransition] = useTransition()
  function onClick() {
    startTransition(async () => {
      const res = kind === "fine" ? await deleteFine(id) : await deleteLoan(id)
      if (res.error) toast.error(res.error)
      else toast.success("Eliminado")
    })
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={isPending}>
      {isPending ? "…" : "Eliminar"}
    </Button>
  )
}
```

- [ ] **Step 5: Extend `sylvanas/app/dashboard/services/page.tsx`** to load and render fines/loans

In `loadData()`, fetch fines and loans alongside the existing data:
```ts
async function loadData() {
  const [services, models, payMethods, fines, loans] = await Promise.all([
    apiFetch<Service[]>("/services"),
    apiFetch<Model[]>("/models"),
    apiFetch<PayMethod[]>("/pay-methods"),
    apiFetch<Fine[]>("/fines"),
    apiFetch<Loan[]>("/loans"),
  ])
  return { services, models, payMethods, fines, loans }
}
```
Add imports: `Fine`, `Loan` from `@/lib/types`; `RegisterMovementDialog`, `DeleteMovementButton`; the admin role check via `getSession` from `@/lib/session`.

Add the two action buttons next to "Nuevo servicio" in the header:
```tsx
<div className="flex gap-2">
  <RegisterMovementDialog kind="fine" models={models.map((m) => ({ id: m.id, name: m.name }))} />
  <RegisterMovementDialog kind="loan" models={models.map((m) => ({ id: m.id, name: m.name }))} />
  <Link href="/dashboard/services/new" className={buttonVariants()}>Nuevo servicio</Link>
</div>
```

After the services table, add two sections (build a `modelName` map as the page already does). Render a "Multas de hoy" section and a "Préstamos de hoy" section. Each row: modelo, monto (`formatCOP`), motivo, hora (`formatBogotaDate(createdAt, { hour: "2-digit", minute: "2-digit" })`), and an actions cell. For fines, the delete button is admin-only (`session?.role === "admin"`); for loans it shows for admin and monitor. Skip soft-deleted rows for monitor by relying on the API scope; for admin, fines/loans GET returns all (including deleted) — show deleted ones with `deletedAt !== null` greyed and no delete button.

```tsx
const session = await getSession()
const isAdmin = session?.role === "admin"
// fines section
{fines.length > 0 && (
  <section className="space-y-3">
    <h2 className="text-lg font-medium">Multas de hoy</h2>
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead><TableHead>Modelo</TableHead>
            <TableHead className="text-right">Monto</TableHead><TableHead>Motivo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fines.map((f) => (
            <TableRow key={f.id} className={cn(f.deletedAt !== null && "bg-muted opacity-60")}>
              <TableCell>{formatBogotaDate(f.createdAt, { hour: "2-digit", minute: "2-digit" })}</TableCell>
              <TableCell>{modelName.get(f.modelId) ?? f.modelId}</TableCell>
              <TableCell className="text-right">{formatCOP(f.amount)}</TableCell>
              <TableCell className="text-muted-foreground">{f.reason}</TableCell>
              <TableCell className="text-right">
                {isAdmin && f.deletedAt === null && <DeleteMovementButton kind="fine" id={f.id} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </section>
)}
```
Repeat an analogous "Préstamos de hoy" section for `loans`, where the delete button shows when `session?.role === "admin" || session?.role === "monitor"` and `l.deletedAt === null`.

- [ ] **Step 6: Verify typecheck + build**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build`
Expected: 0 type errors; build succeeds; `/dashboard/services` route compiles.

- [ ] **Step 7: Commit**

```bash
git add sylvanas/app/dashboard/services sylvanas/lib/types.ts
git commit -m "feat(sylvanas): inline fines/loans registration + today sections in daily panel"
```

---

## Task 8: Frontend — model balance + settlement (sylvanas, admin)

**Files:**
- Create: `sylvanas/app/dashboard/models/[id]/settlement-actions.ts`
- Create: `sylvanas/app/dashboard/models/[id]/payment-dialog.tsx`
- Modify: `sylvanas/app/dashboard/models/[id]/page.tsx`
- Modify: `sylvanas/lib/types.ts`

**Interfaces:**
- Consumes: `apiFetch`, `formatCOP`, `formatBogotaDate`, `PayMethod`, `Fine`, `Loan`.
- Produces: `Payment`, `ModelBalance` types; `createPayment` server action.

- [ ] **Step 1: Add types to `sylvanas/lib/types.ts`**

```ts
export interface Payment {
  id: string
  modelId: string
  amount: number
  payMethodId: string
  createdBy: string
  createdAt: number
}

export interface ModelBalance {
  balance: number
  totalEarnings: number
  totalFines: number
  totalLoans: number
  totalPayments: number
}
```

- [ ] **Step 2: Create `sylvanas/app/dashboard/models/[id]/settlement-actions.ts`**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export async function createPayment(
  modelId: string,
  amount: number,
  payMethodId: string
): Promise<{ error?: string }> {
  try {
    await apiFetch("/payments", {
      method: "POST",
      body: JSON.stringify({ modelId, amount, payMethodId }),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al registrar el pago" }
  }
  revalidatePath(`/dashboard/models/${modelId}`)
  return {}
}
```

- [ ] **Step 3: Create `sylvanas/app/dashboard/models/[id]/payment-dialog.tsx`**

```tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createPayment } from "./settlement-actions"
import { formatCOP } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  amount: z.coerce.number().int().positive("Monto inválido"),
  payMethodId: z.string().min(1, "Selecciona un método"),
})
type FormValues = z.input<typeof schema>

export function PaymentDialog({
  modelId,
  currentBalance,
  payMethods,
}: {
  modelId: string
  currentBalance: number
  payMethods: { id: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: Math.max(0, currentBalance) } as FormValues,
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await createPayment(modelId, Number(values.amount), values.payMethodId)
      if (res.error) { toast.error(res.error); return }
      toast.success("Pago registrado")
      setOpen(false)
    })
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Realizar pago</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Realizar pago — saldo actual {formatCOP(currentBalance)}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Monto a pagar</Label>
            <Input id="pay-amount" type="number" min={1} step={1} {...register("amount")} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-method">Método de pago</Label>
            <select id="pay-method" className={selectClass} {...register("payMethodId")}>
              <option value="">Selecciona…</option>
              {payMethods.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
            </select>
            {errors.payMethodId && <p className="text-sm text-destructive">{errors.payMethodId.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando…" : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Extend `sylvanas/app/dashboard/models/[id]/page.tsx`**

Add fetches (in parallel with the existing `/users/:id` + images): `model-balance`, `payments`, `fines`, `loans`, `pay-methods`. Filter fines/loans to this model client-side (the admin GET returns all). Render, above the gallery:

1. A **balance card** with the breakdown:
```tsx
<Card>
  <CardContent className="space-y-2 py-4">
    <p className="text-sm text-muted-foreground">Saldo actual</p>
    <p className={cn("text-3xl font-semibold", balance.balance < 0 && "text-destructive")}>
      {formatCOP(balance.balance)}
    </p>
    <div className="grid grid-cols-2 gap-2 pt-2 text-sm sm:grid-cols-4">
      <div><span className="text-muted-foreground">Ganancias </span>{formatCOP(balance.totalEarnings)}</div>
      <div><span className="text-muted-foreground">− Multas </span>{formatCOP(balance.totalFines)}</div>
      <div><span className="text-muted-foreground">− Préstamos </span>{formatCOP(balance.totalLoans)}</div>
      <div><span className="text-muted-foreground">− Pagos </span>{formatCOP(balance.totalPayments)}</div>
    </div>
    <div className="pt-3">
      <PaymentDialog modelId={id} currentBalance={balance.balance} payMethods={payOptions} />
    </div>
  </CardContent>
</Card>
```
where `payOptions = payMethods.map((p) => ({ id: p.id, label: p.displayName ? `${p.code} — ${p.displayName}` : p.code }))`.

2. A **payment history** table (`payments` for this model): fecha (`formatBogotaDate`), monto (`formatCOP`), método (`payCode.get(p.payMethodId)`).

3. A **fines** table and a **loans** table for this model: fecha, monto, motivo. (Read-only here; deletions happen in the daily panel.)

- [ ] **Step 5: Verify typecheck + build**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build`
Expected: 0 type errors; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add sylvanas/app/dashboard/models/[id] sylvanas/lib/types.ts
git commit -m "feat(sylvanas): model balance + settlement + payment/fine/loan history (admin)"
```

---

## Task 9: Frontend — model profile daily fines/loans (sylvanas, model)

**Files:**
- Modify: `sylvanas/app/dashboard/profile/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `Fine`, `Loan`, `formatCOP`, `formatBogotaDate`.

- [ ] **Step 1: Extend `sylvanas/app/dashboard/profile/page.tsx`** to fetch today's own fines/loans

Add to the parallel fetch:
```ts
const [services, images, fines, loans] = await Promise.all([
  apiFetch<Service[]>("/services"),
  getImages(user.sub),
  apiFetch<Fine[]>("/fines"),
  apiFetch<Loan[]>("/loans"),
])
```
(Import `Fine`, `Loan` from `@/lib/types`.) The API already scopes these to the model's own records from today.

- [ ] **Step 2: Render fines/loans sections** after the services section and before the photo gallery

```tsx
{fines.length > 0 && (
  <section className="space-y-3">
    <h2 className="text-lg font-medium">Mis multas de hoy</h2>
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead><TableHead>Motivo</TableHead>
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fines.map((f) => (
            <TableRow key={f.id}>
              <TableCell>{formatBogotaDate(f.createdAt, { hour: "2-digit", minute: "2-digit" })}</TableCell>
              <TableCell className="text-muted-foreground">{f.reason}</TableCell>
              <TableCell className="text-right">{formatCOP(f.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </section>
)}
```
Add an analogous "Mis préstamos de hoy" section for `loans`. The model sees no balance, no payments.

- [ ] **Step 2b: Note on day total** — the profile already shows "Ganancia total de hoy" from services. Leave it as services-only earnings (the spec does not ask to net fines/loans into the model's daily display; the running balance is admin-only).

- [ ] **Step 3: Verify typecheck + build + tests**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build && npx vitest run`
Expected: 0 type errors; build succeeds; 13/13 unit tests pass.

- [ ] **Step 4: Commit**

```bash
git add sylvanas/app/dashboard/profile/page.tsx
git commit -m "feat(sylvanas): model profile shows own daily fines and loans"
```

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1) ✓; fines API (Task 2) ✓; loans API (Task 3) ✓; payments API (Task 4) ✓; balance report (Task 5) ✓; permissions enforced in each route's `requireRole`/role-scope ✓; daily panel UI (Task 7) ✓; admin balance+settlement UI (Task 8) ✓; model profile daily movements (Task 9) ✓.
- **Balance formula** matches spec exactly: `totalEarnings − totalFines − totalLoans − totalPayments`, using `calcEarnings(...).modelTotal` and active records only (payments always active).
- **Permissions:** fine delete admin-only; loan delete admin+monitor; payment create admin-only; balance/payment-history admin-only — all enforced server-side, with UI gated to match.
- **Type consistency:** `Fine`/`Loan` identical shape; `Payment` and `ModelBalance` defined in Task 8 and consumed there; server actions return `{ error?: string }` throughout.
- **Deploy:** Task 6 rebuilds and commits `dist/index.mjs`; production needs `npm run db:migrate` after deploy (noted).
