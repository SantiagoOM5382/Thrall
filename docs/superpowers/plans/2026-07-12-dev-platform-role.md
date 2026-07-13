# Dev Platform Role (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-level `dev` role that manages brands, creates admins assigned to any brand, and views cross-brand income — Phase 1 (no read-only drill-down).

**Architecture:** Add `dev` to the role type (TS-only; the drizzle sqlite enum emits no DB CHECK, so NO migration). Seed a "Plataforma" brand + a dev user. New dev-only thrall routes for brands CRUD and a cross-brand earnings report; extend `POST/GET /users` so a dev targets any brand. In sylvanas, add `dev` to the Role type, a dev-only sidebar + post-login redirect, a brands page (with admin creation), and a brand-earnings page.

**Tech Stack:** Hono + Drizzle + Turso (thrall); Next.js 15 App Router + shadcn/ui base-ui (sylvanas).

## Global Constraints

- Role `dev` is added to the TS enums ONLY. The drizzle `text('role', { enum: [...] })` does not create a DB CHECK constraint, so there is NO migration; `role` stays plain TEXT. Confirm `npm run db:generate` reports no schema change.
- Dev is cross-brand: RBAC does not filter a dev by `brandId`. The dev user still has a `brand_id` (FK NOT NULL) pointing at a seeded "Plataforma" brand.
- `requireRole('dev')` guards all brand routes and brand-earnings. `POST /users`: dev supplies `brandId` (+ role) in the body; admin still forces `caller.brandId` (unchanged). `GET /users`: dev returns all (optional `?brandId=`); admin still returns only its brand.
- Earnings math reuses `calcEarnings(basePrice, extras).{company, modelTotal}`; `company = 40% base`, `modelTotal = 60% base + extras`. Date range `from/to` are unix ms (full Bogota day), like `/reports/earnings`.
- After any thrall `src/` change: `npm run build` (tsup → `dist/index.mjs`), commit the bundle. Tests: `npm test`. sylvanas verify: `node_modules/.bin/tsc --noEmit` (NOT `npx tsc`) + `npm run build`. Do NOT run `npm run build` in sylvanas while its `next dev` is running (corrupts `.next`) — stop the dev server first or rebuild after.
- shadcn Button/Dialog are base-ui: `render` prop, never `asChild`; link-styled buttons use `buttonVariants()`. Server Actions return `{ error?: string }` + `revalidatePath`; toasts via sonner. Native `<select>` for form dropdowns registered with react-hook-form.

---

## Task 1: thrall — `dev` role plumbing + seed

**Files:**
- Modify: `thrall/src/db/schema.ts` (role enum), `thrall/src/lib/jwt.ts` (TokenPayload role), `thrall/src/middleware/rbac.ts` (param type), `thrall/tests/helpers.ts` (role types)
- Modify: `thrall/scripts/seed.ts` (add Plataforma brand + dev user)
- Create: `thrall/scripts/seed-dev.ts` (idempotent: add Plataforma + dev to an existing DB)
- Create: `thrall/tests/lib/dev-role.test.ts`

**Interfaces:**
- Produces: `Role` now includes `'dev'` across jwt/rbac/helpers; `tokenFor(id, 'dev', brandId)` and `createTestUser(brandId, { role: 'dev' })` work.

- [ ] **Step 1: Write the failing test** in `thrall/tests/lib/dev-role.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from '../../src/lib/jwt'

describe('dev role', () => {
  it('signs and verifies a dev token', async () => {
    const token = await signToken({ sub: 'u1', role: 'dev', brandId: 'b1', name: 'Dev' })
    const payload = await verifyToken(token)
    expect(payload.role).toBe('dev')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- dev-role`
Expected: FAIL to typecheck / `'dev'` not assignable (role type is `'admin'|'monitor'|'model'`).

- [ ] **Step 3: Add `'dev'` to the role types**

In `thrall/src/db/schema.ts`, change the users `role` column enum:
```ts
role: text('role', { enum: ['admin', 'monitor', 'model', 'dev'] }).notNull(),
```
In `thrall/src/lib/jwt.ts`:
```ts
role: 'admin' | 'monitor' | 'model' | 'dev'
```
In `thrall/src/middleware/rbac.ts`:
```ts
export function requireRole(...roles: Array<'admin' | 'monitor' | 'model' | 'dev'>) {
```
In `thrall/tests/helpers.ts`, update both role type annotations:
```ts
overrides: Partial<{ role: 'admin' | 'monitor' | 'model' | 'dev'; email: string; name: string }> = {}
// and
export async function tokenFor(userId: string, role: 'admin' | 'monitor' | 'model' | 'dev', brandId: string) {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd thrall && npm test -- dev-role`
Expected: PASS.

- [ ] **Step 5: Confirm no DB migration is needed**

Run: `cd thrall && npm run db:generate`
Expected: drizzle-kit reports **No schema changes** (the enum is TS-only). If it emits a migration, delete it — the column SQL is unchanged.

- [ ] **Step 6: Update `thrall/scripts/seed.ts`** to also seed the Plataforma brand + dev user (append before the `console.log('✓ Seed complete')`)

```ts
  const platformBrandId = newId()
  await db.insert(brands).values({
    id: platformBrandId, name: 'Plataforma', isActive: 1, createdAt: Date.now(), updatedAt: Date.now(),
  })
  await db.insert(users).values({
    id: newId(), brandId: platformBrandId, name: 'Dev', email: 'dev@arthas.co',
    password: await hashPassword('Dev1234!'), role: 'dev', isActive: 1,
    createdAt: Date.now(), updatedAt: Date.now(),
  })
```
And add to the final logs: `console.log('  Dev:   dev@arthas.co / Dev1234!')`.

- [ ] **Step 7: Create `thrall/scripts/seed-dev.ts`** (idempotent, for the existing prod DB)

```ts
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
```
Add a script to `thrall/package.json`: `"seed:dev": "tsx scripts/seed-dev.ts"`.

- [ ] **Step 8: Run full suite + typecheck**

Run: `cd thrall && npm test && npx tsc --noEmit`
Expected: all pass; 0 type errors.

- [ ] **Step 9: Commit**

```bash
git add thrall/src/db/schema.ts thrall/src/lib/jwt.ts thrall/src/middleware/rbac.ts thrall/tests/helpers.ts thrall/tests/lib/dev-role.test.ts thrall/scripts/seed.ts thrall/scripts/seed-dev.ts thrall/package.json
git commit -m "feat(thrall): add dev role type plumbing + seed platform brand & dev user"
```

---

## Task 2: thrall — brands routes (dev-only)

**Files:**
- Create: `thrall/src/routes/brands.ts`
- Create: `thrall/tests/routes/brands.test.ts`
- Modify: `thrall/src/app.ts` (mount)

**Interfaces:**
- Produces: `GET /api/brands`, `POST /api/brands` `{ name }`, `PUT /api/brands/:id` `{ name?, isActive? }` — all `requireRole('dev')`. `brandsRoutes` exported.

- [ ] **Step 1: Write the failing test** in `thrall/tests/routes/brands.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function devToken() {
  const brandId = await createTestBrand()
  const dev = await createTestUser(brandId, { role: 'dev' })
  return await tokenFor(dev.id, 'dev', brandId)
}

describe('brands routes', () => {
  it('dev can create, list, and edit a brand', async () => {
    const token = await devToken()
    const created = await app.request('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Nueva Brand' }),
    })
    expect(created.status).toBe(201)
    const brand = await created.json()
    expect(brand.name).toBe('Nueva Brand')

    const list = await app.request('/api/brands', { headers: { Authorization: `Bearer ${token}` } })
    expect(list.status).toBe(200)
    const brands = await list.json()
    expect(brands.some((b: { id: string }) => b.id === brand.id)).toBe(true)

    const edited = await app.request(`/api/brands/${brand.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Editada', isActive: 0 }),
    })
    expect(edited.status).toBe(200)
    const eb = await edited.json()
    expect(eb.name).toBe('Editada')
    expect(eb.isActive).toBe(0)
  })

  it('non-dev (admin) is forbidden', async () => {
    const brandId = await createTestBrand()
    const admin = await createTestUser(brandId, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brandId)
    const res = await app.request('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(403)
  })

  it('404 editing a missing brand', async () => {
    const token = await devToken()
    const res = await app.request('/api/brands/nope', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Y' }),
    })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- brands`
Expected: FAIL (route not mounted).

- [ ] **Step 3: Create `thrall/src/routes/brands.ts`**

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { brands, brandSubscriptions } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { newId } from '../lib/ulid'
import { logAudit } from '../lib/audit'

export const brandsRoutes = new Hono<AppEnv>()
brandsRoutes.use('*', authMiddleware, requireRole('dev'))

const createSchema = z.object({ name: z.string().min(1) })
const updateSchema = z.object({ name: z.string().min(1).optional(), isActive: z.number().int().optional() })

brandsRoutes.get('/', async (c) => {
  const all = await db.query.brands.findMany({ orderBy: (b, { desc }) => [desc(b.createdAt)] })
  return c.json(all)
})

brandsRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const caller = c.get('user')
  const { name } = c.req.valid('json')
  const id = newId()
  const now = Date.now()
  await db.insert(brands).values({ id, name, isActive: 1, createdAt: now, updatedAt: now })
  await db.insert(brandSubscriptions).values({
    id: newId(), brandId: id, plan: 'pilot', isActive: 1, createdAt: now, updatedAt: now,
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'brand', entityId: id })
  const created = await db.query.brands.findFirst({ where: eq(brands.id, id) })
  return c.json(created, 201)
})

brandsRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')!
  const existing = await db.query.brands.findFirst({ where: eq(brands.id, id) })
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await db.update(brands).set({ ...c.req.valid('json'), updatedAt: Date.now() }).where(eq(brands.id, id))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'brand', entityId: id })
  const updated = await db.query.brands.findFirst({ where: eq(brands.id, id) })
  return c.json(updated)
})
```

- [ ] **Step 4: Mount in `thrall/src/app.ts`** — add `import { brandsRoutes } from './routes/brands'` and `app.route('/brands', brandsRoutes)`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd thrall && npm test -- brands`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add thrall/src/routes/brands.ts thrall/tests/routes/brands.test.ts thrall/src/app.ts
git commit -m "feat(thrall): brands routes (dev-only CRUD)"
```

---

## Task 3: thrall — users route dev extension

**Files:**
- Modify: `thrall/src/routes/users.ts` (POST accepts brandId for dev; GET returns all for dev)
- Create: `thrall/tests/routes/users-dev.test.ts`

**Interfaces:**
- Consumes: existing `usersRoutes` (currently admin-only via `requireRole('admin')` on the router).
- Produces: dev can `POST /users` with `{ name, email, password, role, brandId }` into any brand; dev `GET /users` returns all (optional `?brandId=`).

- [ ] **Step 1: Write the failing test** in `thrall/tests/routes/users-dev.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

describe('users route — dev', () => {
  it('dev creates an admin in a chosen brand', async () => {
    const platformBrand = await createTestBrand()
    const targetBrand = await createTestBrand()
    const dev = await createTestUser(platformBrand, { role: 'dev' })
    const token = await tokenFor(dev.id, 'dev', platformBrand)

    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Admin Nuevo', email: `a-${Date.now()}@t.co`, password: 'secret123',
        role: 'admin', brandId: targetBrand,
      }),
    })
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created.brandId).toBe(targetBrand)
    expect(created.role).toBe('admin')
  })

  it('dev GET /users returns users across brands; ?brandId filters', async () => {
    const platformBrand = await createTestBrand()
    const brandA = await createTestBrand()
    const dev = await createTestUser(platformBrand, { role: 'dev' })
    await createTestUser(brandA, { role: 'admin' })
    const token = await tokenFor(dev.id, 'dev', platformBrand)

    const all = await app.request('/api/users', { headers: { Authorization: `Bearer ${token}` } })
    const allBody = await all.json()
    expect(allBody.length).toBeGreaterThanOrEqual(2)

    const filtered = await app.request(`/api/users?brandId=${brandA}`, { headers: { Authorization: `Bearer ${token}` } })
    const fBody = await filtered.json()
    expect(fBody.every((u: { brandId: string }) => u.brandId === brandA)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- users-dev`
Expected: FAIL — the router is `requireRole('admin')` so dev gets 403; and POST ignores body brandId.

- [ ] **Step 3: Edit `thrall/src/routes/users.ts`**

Change the router guard to allow dev too:
```ts
usersRoutes.use('*', authMiddleware, requireRole('admin', 'dev'))
```
Add `brandId` back to `createSchema` as optional (dev supplies it; admin's is ignored):
```ts
const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'monitor', 'model', 'dev']),
  brandId: z.string().optional(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().optional(),
})
```
In `GET /`, branch by role:
```ts
usersRoutes.get('/', async (c) => {
  const caller = c.get('user')
  const brandFilter = c.req.query('brandId')
  const all = await db.query.users.findMany({
    where: (u, { and, eq: eqFn, isNull }) => {
      const conds = [isNull(u.deletedAt)]
      if (caller.role === 'dev') {
        if (brandFilter) conds.push(eqFn(u.brandId, brandFilter))
      } else {
        conds.push(eqFn(u.brandId, caller.brandId))
      }
      return and(...conds)
    },
  })
  return c.json(all.map(omitPassword))
})
```
In `POST /`, pick the brand by role (dev uses body `brandId`, admin forces its own):
```ts
usersRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json')
  const caller = c.get('user')
  const targetBrandId = caller.role === 'dev' ? data.brandId : caller.brandId
  if (!targetBrandId) return c.json({ error: 'brandId is required' }, 400)

  const id = newId()
  const now = Date.now()
  const { brandId: _ignored, ...rest } = data
  await db.insert(users).values({
    id,
    ...rest,
    brandId: targetBrandId,
    password: await hashPassword(data.password),
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  })
  await logAudit(db, { userId: caller.sub, action: 'CREATE', entity: 'user', entityId: id })
  const created = await db.query.users.findFirst({ where: eq(users.id, id) })
  return c.json(omitPassword(created!), 201)
})
```
(Leave the PUT/DELETE handlers as-is; they remain reachable by admins and now devs — acceptable for Phase 1. Do not otherwise change them.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd thrall && npm test -- users-dev`
Expected: PASS (2 tests). Also run the existing users test: `npm test -- users` — still green (admin path unchanged: admin has no `brandId` in body so `targetBrandId = caller.brandId`).

- [ ] **Step 5: Commit**

```bash
git add thrall/src/routes/users.ts thrall/tests/routes/users-dev.test.ts
git commit -m "feat(thrall): dev can create admins in any brand and list users cross-brand"
```

---

## Task 4: thrall — brand-earnings report (dev-only)

**Files:**
- Modify: `thrall/src/routes/reports.ts` (add handler)
- Create: `thrall/tests/routes/brand-earnings.test.ts`

**Interfaces:**
- Produces: `GET /api/reports/brand-earnings?from=&to=` [dev] → `{ rows: [{ brandId, brandName, totalServices, totalBase, companyEarnings, modelTotalEarnings }], totals: {...} }`.

- [ ] **Step 1: Write the failing test** in `thrall/tests/routes/brand-earnings.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import {
  createTestBrand, createTestUser, tokenFor, createTestPayMethod, createTestService,
} from '../helpers'

describe('brand-earnings report', () => {
  it('sums earnings per brand for a dev', async () => {
    const brandA = await createTestBrand()
    const adminA = await createTestUser(brandA, { role: 'admin' })
    const modelA = await createTestUser(brandA, { role: 'model' })
    const pm = await createTestPayMethod()
    // one service basePrice 100000, extras [20000] → company 40000, modelTotal 80000
    await createTestService(modelA.id, adminA.id, pm, [20000])

    const platform = await createTestBrand()
    const dev = await createTestUser(platform, { role: 'dev' })
    const token = await tokenFor(dev.id, 'dev', platform)

    const res = await app.request(`/api/reports/brand-earnings?from=0&to=${Date.now() + 1000}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const rowA = body.rows.find((r: { brandId: string }) => r.brandId === brandA)
    expect(rowA.totalServices).toBe(1)
    expect(rowA.totalBase).toBe(100000)
    expect(rowA.companyEarnings).toBe(40000)
    expect(rowA.modelTotalEarnings).toBe(80000)
    expect(body.totals.companyEarnings).toBeGreaterThanOrEqual(40000)
  })

  it('is dev-only', async () => {
    const brandId = await createTestBrand()
    const admin = await createTestUser(brandId, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brandId)
    const res = await app.request('/api/reports/brand-earnings', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- brand-earnings`
Expected: FAIL (route missing → 404/403).

- [ ] **Step 3: Add the handler to `thrall/src/routes/reports.ts`**

Ensure `brands` is in the schema import line (add it if missing):
```ts
import { services, serviceExtras, users, fines, loans, payments, brands } from '../db/schema'
```
Add the handler (after the existing `/model-balance/:id` route):
```ts
reportsRoutes.get('/brand-earnings', requireRole('dev'), async (c) => {
  const from = Number(c.req.query('from') ?? 0)
  const to = Number(c.req.query('to') ?? Date.now())

  const allBrands = await db.query.brands.findMany({ orderBy: (b, { asc }) => [asc(b.name)] })
  const models = await db.query.users.findMany({ where: (u, { eq: eqFn }) => eqFn(u.role, 'model') })
  const modelBrand = new Map(models.map((m) => [m.id, m.brandId]))

  const svcs = await db.query.services.findMany({
    where: (s, { and, between, isNull }) => and(between(s.startTime, from, to), isNull(s.deletedAt)),
  })

  const acc = new Map<string, { totalServices: number; totalBase: number; companyEarnings: number; modelTotalEarnings: number }>()
  for (const b of allBrands) acc.set(b.id, { totalServices: 0, totalBase: 0, companyEarnings: 0, modelTotalEarnings: 0 })

  for (const s of svcs) {
    const brandId = modelBrand.get(s.modelId)
    if (!brandId || !acc.has(brandId)) continue
    const extras = await db.query.serviceExtras.findMany({ where: eq(serviceExtras.serviceId, s.id) })
    const e = calcEarnings(s.basePrice, extras.map((x) => x.amount))
    const a = acc.get(brandId)!
    a.totalServices += 1
    a.totalBase += s.basePrice
    a.companyEarnings += e.company
    a.modelTotalEarnings += e.modelTotal
  }

  const rows = allBrands.map((b) => ({ brandId: b.id, brandName: b.name, ...acc.get(b.id)! }))
  const totals = rows.reduce(
    (t, r) => ({
      totalServices: t.totalServices + r.totalServices,
      totalBase: t.totalBase + r.totalBase,
      companyEarnings: t.companyEarnings + r.companyEarnings,
      modelTotalEarnings: t.modelTotalEarnings + r.modelTotalEarnings,
    }),
    { totalServices: 0, totalBase: 0, companyEarnings: 0, modelTotalEarnings: 0 }
  )
  return c.json({ rows, totals })
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd thrall && npm test -- brand-earnings`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add thrall/src/routes/reports.ts thrall/tests/routes/brand-earnings.test.ts
git commit -m "feat(thrall): cross-brand earnings report (dev-only)"
```

---

## Task 5: thrall — verify all + rebuild bundle

**Files:**
- Verify: `thrall/src/app.ts` (brands mounted)
- Modify: `thrall/dist/index.mjs` (rebuilt)

- [ ] **Step 1: Confirm `app.ts` mounts brands** — it should contain `app.route('/brands', brandsRoutes)`.

- [ ] **Step 2: Full suite + typecheck**

Run: `cd thrall && npm test && npx tsc --noEmit`
Expected: all pass; 0 type errors.

- [ ] **Step 3: Rebuild the bundle**

Run: `cd thrall && npm run build`
Expected: `dist/index.mjs` rebuilt.

- [ ] **Step 4: Commit**

```bash
git add thrall/dist/index.mjs
git commit -m "build(thrall): rebuild bundle with dev role, brands, brand-earnings"
```

> After deploy, run `npm run seed:dev` once against prod Turso to create the dev user (`dev@arthas.co` / `Dev1234!`). For local dev, the running thrall picks up src via tsx watch; run `npm run seed:dev` locally too.

---

## Task 6: sylvanas — Role, session, redirect, dev sidebar

**Files:**
- Modify: `sylvanas/lib/types.ts` (Role), `sylvanas/lib/session.ts` (role type), `sylvanas/app/dashboard/page.tsx` (redirect), `sylvanas/components/layout/sidebar.tsx` (dev group)

**Interfaces:**
- Produces: `Role` includes `'dev'`; dev sees a "Plataforma" sidebar group; dev post-login lands on `/dashboard/brands`.

- [ ] **Step 1: Add `'dev'` to the Role type** in `sylvanas/lib/types.ts`:
```ts
export type Role = "admin" | "monitor" | "model" | "dev"
```

- [ ] **Step 2: Widen the session role type** in `sylvanas/lib/session.ts`:
```ts
  role: "admin" | "monitor" | "model" | "dev"
```

- [ ] **Step 3: Redirect dev after login** — in `sylvanas/app/dashboard/page.tsx`:
```ts
export default async function DashboardIndex() {
  const user = await getSession()
  if (!user) redirect("/login")
  if (user.role === "dev") redirect("/dashboard/brands")
  redirect(user.role === "model" ? "/dashboard/profile" : "/dashboard/services")
}
```

- [ ] **Step 4: Add the dev nav group** in `sylvanas/components/layout/sidebar.tsx`. Import two icons that already come from `lucide-react` (add `LayoutGrid` and reuse `Building2`), and append a group to `GROUPS`:
```ts
  {
    label: "Plataforma",
    items: [
      { href: "/dashboard/brands", label: "Brands", icon: LayoutGrid, roles: ["dev"] },
      { href: "/dashboard/brand-earnings", label: "Ingresos por brand", icon: Building2, roles: ["dev"] },
    ],
  },
```
Add `LayoutGrid` to the existing `lucide-react` import. Also add `dev` to the `ROLE_LABEL` record:
```ts
const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  monitor: "Monitor",
  model: "Modelo",
  dev: "Dev",
}
```
The existing operational groups already restrict via `roles` arrays that don't include `dev`, so the dev sees only the Plataforma group. No other change.

- [ ] **Step 5: Verify typecheck + build**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build`
Expected: 0 type errors; build succeeds. (Stop `next dev` first if running.)

- [ ] **Step 6: Commit**

```bash
git add sylvanas/lib/types.ts sylvanas/lib/session.ts sylvanas/app/dashboard/page.tsx sylvanas/components/layout/sidebar.tsx
git commit -m "feat(sylvanas): dev role — session type, redirect, platform sidebar group"
```

---

## Task 7: sylvanas — brands page (list/create/edit + admins + new admin)

**Files:**
- Modify: `sylvanas/lib/types.ts` (Brand type)
- Create: `sylvanas/app/dashboard/brands/actions.ts`
- Create: `sylvanas/app/dashboard/brands/brand-form-dialog.tsx`
- Create: `sylvanas/app/dashboard/brands/new-admin-dialog.tsx`
- Create: `sylvanas/app/dashboard/brands/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `User` type, base-ui Dialog/Button, sonner.
- Produces: `Brand` type; `createBrand`, `updateBrand`, `createBrandAdmin` actions.

- [ ] **Step 1: Add the `Brand` type** to `sylvanas/lib/types.ts`:
```ts
export interface Brand {
  id: string
  name: string
  isActive: number
  createdAt: number
  updatedAt: number
}
```

- [ ] **Step 2: Create `sylvanas/app/dashboard/brands/actions.ts`**
```ts
"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export async function createBrand(name: string): Promise<{ error?: string }> {
  try {
    await apiFetch("/brands", { method: "POST", body: JSON.stringify({ name }) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear brand" }
  }
  revalidatePath("/dashboard/brands")
  return {}
}

export async function updateBrand(
  id: string,
  data: { name?: string; isActive?: number }
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/brands/${id}`, { method: "PUT", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al actualizar" }
  }
  revalidatePath("/dashboard/brands")
  return {}
}

export interface NewAdminInput {
  brandId: string
  name: string
  email: string
  password: string
}

export async function createBrandAdmin(data: NewAdminInput): Promise<{ error?: string }> {
  try {
    await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "admin" }),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear admin" }
  }
  revalidatePath("/dashboard/brands")
  return {}
}
```

- [ ] **Step 3: Create `sylvanas/app/dashboard/brands/brand-form-dialog.tsx`** (create + edit)
```tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createBrand, updateBrand } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({ name: z.string().min(1, "Nombre requerido") })
type FormValues = z.infer<typeof schema>

export function BrandFormDialog({
  mode,
  initial,
}: {
  mode: "create" | "edit"
  initial?: { id: string; name: string }
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? "" },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = mode === "create"
        ? await createBrand(values.name)
        : await updateBrand(initial!.id, { name: values.name })
      if (res.error) { toast.error(res.error); return }
      toast.success(mode === "create" ? "Brand creada" : "Brand actualizada")
      setOpen(false)
      if (mode === "create") reset({ name: "" })
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={mode === "create" ? "default" : "ghost"} size="sm" />}>
        {mode === "create" ? "Nueva brand" : "Editar"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nueva brand" : "Editar brand"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="brand-name">Nombre</Label>
            <Input id="brand-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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

- [ ] **Step 4: Create `sylvanas/app/dashboard/brands/new-admin-dialog.tsx`**
```tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createBrandAdmin } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
})
type FormValues = z.infer<typeof schema>

export function NewAdminDialog({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await createBrandAdmin({ brandId, ...values })
      if (res.error) { toast.error(res.error); return }
      toast.success("Admin creado")
      setOpen(false)
      reset({ name: "", email: "", password: "" })
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Nuevo admin</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo admin — {brandName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="na-name">Nombre</Label>
            <Input id="na-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="na-email">Correo</Label>
            <Input id="na-email" type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="na-password">Contraseña</Label>
            <Input id="na-password" type="text" {...register("password")} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando…" : "Crear admin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Create `sylvanas/app/dashboard/brands/page.tsx`**
```tsx
import { apiFetch } from "@/lib/api"
import type { Brand, User } from "@/lib/types"
import { formatBogotaDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandFormDialog } from "./brand-form-dialog"
import { NewAdminDialog } from "./new-admin-dialog"

export const dynamic = "force-dynamic"

export default async function BrandsPage() {
  const [brands, users] = await Promise.all([
    apiFetch<Brand[]>("/brands"),
    apiFetch<User[]>("/users"),
  ])
  const adminsByBrand = new Map<string, User[]>()
  for (const u of users) {
    if (u.role !== "admin") continue
    const list = adminsByBrand.get(u.brandId) ?? []
    list.push(u)
    adminsByBrand.set(u.brandId, list)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
        <BrandFormDialog mode="create" />
      </div>

      {brands.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No hay brands.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {brands.map((b) => {
            const admins = adminsByBrand.get(b.id) ?? []
            return (
              <Card key={b.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{b.name}</CardTitle>
                    {b.isActive === 1 ? (
                      <Badge>Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <BrandFormDialog mode="edit" initial={{ id: b.id, name: b.name }} />
                    <NewAdminDialog brandId={b.id} brandName={b.name} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Creada {formatBogotaDate(b.createdAt, { dateStyle: "medium" })}
                  </p>
                  <p className="font-medium">Admins ({admins.length})</p>
                  {admins.length === 0 ? (
                    <p className="text-muted-foreground">Sin admins.</p>
                  ) : (
                    <ul className="text-muted-foreground">
                      {admins.map((a) => (
                        <li key={a.id}>{a.name} · {a.email}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Verify typecheck + build**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build`
Expected: 0 type errors; build succeeds; `/dashboard/brands` compiles. (Stop `next dev` first.)

- [ ] **Step 7: Commit**

```bash
git add sylvanas/lib/types.ts sylvanas/app/dashboard/brands
git commit -m "feat(sylvanas): dev brands page — create/edit brands, list & create admins"
```

---

## Task 8: sylvanas — brand-earnings page

**Files:**
- Modify: `sylvanas/lib/types.ts` (BrandEarnings types)
- Create: `sylvanas/app/dashboard/brand-earnings/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `DateRangePicker`, `formatCOP`, `todayBogota`, `dayStartBogotaMs`, `dayEndBogotaMs`.

- [ ] **Step 1: Add types** to `sylvanas/lib/types.ts`:
```ts
export interface BrandEarningRow {
  brandId: string
  brandName: string
  totalServices: number
  totalBase: number
  companyEarnings: number
  modelTotalEarnings: number
}

export interface BrandEarningsReport {
  rows: BrandEarningRow[]
  totals: {
    totalServices: number
    totalBase: number
    companyEarnings: number
    modelTotalEarnings: number
  }
}
```

- [ ] **Step 2: Add a `firstOfMonthBogota` helper** to `sylvanas/lib/utils.ts`:
```ts
/** First day of the current month as "YYYY-MM-DD" in America/Bogota. */
export function firstOfMonthBogota(): string {
  return todayBogota().slice(0, 8) + "01"
}
```

- [ ] **Step 3: Create `sylvanas/app/dashboard/brand-earnings/page.tsx`**
```tsx
import { apiFetch } from "@/lib/api"
import type { BrandEarningsReport } from "@/lib/types"
import {
  formatCOP,
  todayBogota,
  firstOfMonthBogota,
  dayStartBogotaMs,
  dayEndBogotaMs,
} from "@/lib/utils"
import { DateRangePicker } from "@/components/shared/date-range-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

export default async function BrandEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const from = sp.from ?? firstOfMonthBogota()
  const to = sp.to ?? todayBogota()
  const fromMs = dayStartBogotaMs(from)
  const toMs = dayEndBogotaMs(to)

  const report = await apiFetch<BrandEarningsReport>(
    `/reports/brand-earnings?from=${fromMs}&to=${toMs}`
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ingresos por brand</h1>
      <DateRangePicker />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead className="text-right">Servicios</TableHead>
              <TableHead className="text-right">Base total</TableHead>
              <TableHead className="text-right">Ganancia empresa</TableHead>
              <TableHead className="text-right">Ganancia modelos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((r) => (
              <TableRow key={r.brandId}>
                <TableCell className="font-medium">{r.brandName}</TableCell>
                <TableCell className="text-right">{r.totalServices}</TableCell>
                <TableCell className="text-right">{formatCOP(r.totalBase)}</TableCell>
                <TableCell className="text-right">{formatCOP(r.companyEarnings)}</TableCell>
                <TableCell className="text-right">{formatCOP(r.modelTotalEarnings)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totales</TableCell>
              <TableCell className="text-right">{report.totals.totalServices}</TableCell>
              <TableCell className="text-right">{formatCOP(report.totals.totalBase)}</TableCell>
              <TableCell className="text-right font-semibold">
                {formatCOP(report.totals.companyEarnings)}
              </TableCell>
              <TableCell className="text-right">
                {formatCOP(report.totals.modelTotalEarnings)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify typecheck + build + tests**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build && npx vitest run`
Expected: 0 type errors; build succeeds; existing util tests pass. (Stop `next dev` first.)

- [ ] **Step 5: Commit**

```bash
git add sylvanas/lib/types.ts sylvanas/lib/utils.ts sylvanas/app/dashboard/brand-earnings
git commit -m "feat(sylvanas): dev cross-brand earnings page with date range"
```

---

## Self-Review Notes

- **Spec coverage:** dev role type + seed (Task 1) ✓; brands CRUD dev-only (Task 2) ✓; POST/GET users dev extension (Task 3) ✓; brand-earnings report (Task 4) ✓; bundle rebuild + seed:dev note (Task 5) ✓; Role/session/redirect/sidebar (Task 6) ✓; brands page + admin creation (Task 7) ✓; brand-earnings page (Task 8) ✓. Phase-2 drill-down correctly excluded.
- **No migration:** the drizzle sqlite enum is TS-only; Task 1 Step 5 confirms `db:generate` reports no change. `role` stays TEXT so existing prod rows and new `dev` rows are valid.
- **Multi-tenant safety preserved:** admin `POST /users` still forces `caller.brandId` (dev is the only role reading `brandId` from the body); admin `GET /users` still filters to its own brand. Verified by re-running the existing `users` test in Task 3 Step 4.
- **Type consistency:** `Role` gains `'dev'` in thrall (jwt/rbac/helpers/schema) and sylvanas (types/session); `Brand`, `BrandEarningRow`, `BrandEarningsReport`, `User` all defined before use. `createBrandAdmin` posts `role: "admin"` + `brandId` matching thrall's dev `POST /users` contract.
- **Bootstrap:** `seed:dev` is idempotent (skips if `dev@arthas.co` exists) so it is safe to run against the already-seeded prod Turso.
