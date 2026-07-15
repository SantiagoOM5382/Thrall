# Multi-tenancy: FREE / PAID tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two-tier (FREE/PAID) multi-tenant access with 10-day trial, public signup from illidan, and feature gating in thrall + sylvanas — leaving Wompi integration hooks in place.

**Architecture:** Reshape `brand_subscriptions` to model `tier`, `status`, `trialEndsAt`, `paidUntil`, `isGrandfathered`. A new thrall middleware `requirePaid` mounts on the accounting routes and computes effective-access lazily (also flipping expired rows). New public endpoint `POST /api/auth/signup` provisions brand + admin + trial atomically. Sylvanas gets a `useSubscription` context, a `/signup` page, a locked-page wrapper, and a trial banner. Illidan adds a "Forma parte" CTA.

**Tech Stack:** Hono, Drizzle, libsql/Turso, Vitest (thrall). Next.js 15 App Router, Tailwind, Vitest (sylvanas). Next.js 15 (illidan).

## Global Constraints

- Do NOT implement Wompi checkout, webhooks, wallet, tokens, boosts, or top services in this plan.
- All new code follows existing patterns: Hono routes with `zValidator` + `authMiddleware` where applicable; ULIDs via `newId()`; timestamps as `Date.now()` millis (integer column); Drizzle SQLite schema in `src/db/schema.ts`.
- `dev` role bypasses subscription gating everywhere.
- One row per brand in `brand_subscriptions` (unique index on `brandId`), mutated in place.
- Spec of record: `docs/superpowers/specs/2026-07-15-multi-tenancy-free-paid-tiers.md`.
- After every thrall src change: `npm run build` in `thrall/` and commit the regenerated `dist/index.mjs` (see memory `thrall-vercel-deploy`). Do NOT skip this — Vercel serves the committed bundle.
- Sylvanas: pin Next 15 / SWC as-is; do not upgrade (see memory `sylvanas-dev-env`).

---

## Task 1: Reshape `brand_subscriptions` schema + migration + grandfather existing brand

**Files:**
- Modify: `thrall/src/db/schema.ts` (the `brandSubscriptions` block)
- Create: `thrall/migrations/0002_multi_tenancy_tiers.sql`
- Modify: `thrall/tests/helpers.ts` (`createTestBrand` uses new columns)
- Modify: `thrall/scripts/seed.ts` if it inserts brand_subscriptions (check; may not exist)

**Interfaces:**
- Produces: `brandSubscriptions` table columns `{ id, brandId, tier, status, trialEndsAt, paidUntil, isGrandfathered, createdAt, updatedAt }` with unique index on `brandId`. Column `tier` is `'free' | 'paid'`, `status` is `'active' | 'trial' | 'expired'`.

- [ ] **Step 1: Update Drizzle schema**

Replace the `brandSubscriptions` definition in `thrall/src/db/schema.ts` with:

```ts
export const brandSubscriptions = sqliteTable('brand_subscriptions', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  tier: text('tier', { enum: ['free', 'paid'] }).notNull().default('free'),
  status: text('status', { enum: ['active', 'trial', 'expired'] }).notNull().default('trial'),
  trialEndsAt: integer('trial_ends_at'),
  paidUntil: integer('paid_until'),
  isGrandfathered: integer('is_grandfathered').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  brandIdx: uniqueIndex('brand_subscriptions_brand_idx').on(t.brandId),
}))
```

- [ ] **Step 2: Write the migration SQL**

Create `thrall/migrations/0002_multi_tenancy_tiers.sql`:

```sql
-- Rebuild brand_subscriptions with new columns; SQLite requires table recreation
-- to drop columns / add NOT NULL columns cleanly.
CREATE TABLE brand_subscriptions_new (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at INTEGER,
  paid_until INTEGER,
  is_grandfathered INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Grandfather every pre-existing brand as PAID active.
INSERT INTO brand_subscriptions_new (id, brand_id, tier, status, paid_until, is_grandfathered, created_at, updated_at)
SELECT id, brand_id, 'paid', 'active', NULL, 1, created_at, updated_at
FROM brand_subscriptions;

DROP TABLE brand_subscriptions;
ALTER TABLE brand_subscriptions_new RENAME TO brand_subscriptions;

CREATE UNIQUE INDEX brand_subscriptions_brand_idx ON brand_subscriptions(brand_id);
```

- [ ] **Step 3: Update the test helper**

In `thrall/tests/helpers.ts` `createTestBrand`, replace the `db.insert(brandSubscriptions)` block with:

```ts
await db.insert(brandSubscriptions).values({
  id: newId(),
  brandId: id,
  tier: 'paid',
  status: 'active',
  isGrandfathered: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

Also add an optional argument so tests can override for the FREE scenarios:

```ts
export async function createTestBrand(opts: {
  tier?: 'free' | 'paid'
  status?: 'active' | 'trial' | 'expired'
  trialEndsAt?: number | null
  paidUntil?: number | null
  isGrandfathered?: 0 | 1
} = {}) {
  const id = newId()
  await db.insert(brands).values({
    id, name: 'Test Brand', isActive: 1,
    createdAt: Date.now(), updatedAt: Date.now(),
  })
  await db.insert(brandSubscriptions).values({
    id: newId(),
    brandId: id,
    tier: opts.tier ?? 'paid',
    status: opts.status ?? 'active',
    trialEndsAt: opts.trialEndsAt ?? null,
    paidUntil: opts.paidUntil ?? null,
    isGrandfathered: opts.isGrandfathered ?? 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  return id
}
```

- [ ] **Step 4: Run the existing test suite (should still pass because default = grandfathered PAID)**

Run: `cd thrall && npm test`
Expected: all suites pass; no new tests yet.

- [ ] **Step 5: Apply migration locally and to prod later**

Run: `cd thrall && npm run db:migrate`
Expected: migration `0002` recorded; existing rows preserved as grandfathered.

- [ ] **Step 6: Rebuild bundle**

Run: `cd thrall && npm run build`
Expected: `dist/index.mjs` regenerated.

- [ ] **Step 7: Commit**

```bash
git add thrall/src/db/schema.ts thrall/migrations/0002_multi_tenancy_tiers.sql thrall/tests/helpers.ts thrall/dist/index.mjs
git commit -m "feat(thrall): reshape brand_subscriptions for tier/status/trial"
```

---

## Task 2: Public signup endpoint `POST /api/auth/signup`

**Files:**
- Modify: `thrall/src/routes/auth.ts`
- Create: `thrall/tests/routes/signup.test.ts`

**Interfaces:**
- Consumes: `brandSubscriptions` columns from Task 1.
- Produces: `POST /api/auth/signup` accepting `{ brandName, adminName, email, password }` and returning `{ token, user }`. Creates a `brands` row + `brand_subscriptions` row (tier=free, status=trial, trialEndsAt=now+10d) + `users` row (role=admin).

- [ ] **Step 1: Write the failing tests**

Create `thrall/tests/routes/signup.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db/client'
import { brands, users, brandSubscriptions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'

describe('POST /api/auth/signup', () => {
  it('creates brand + admin + trial subscription and returns a token', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: 'Acme Models', adminName: 'Jane', email: 'jane@acme.co', password: 'password123',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBeTypeOf('string')
    expect(body.user.role).toBe('admin')

    const user = await db.query.users.findFirst({ where: eq(users.email, 'jane@acme.co') })
    expect(user).toBeTruthy()
    const brand = await db.query.brands.findFirst({ where: eq(brands.id, user!.brandId) })
    expect(brand?.name).toBe('Acme Models')
    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand!.id) })
    expect(sub?.tier).toBe('free')
    expect(sub?.status).toBe('trial')
    expect(sub?.trialEndsAt).toBeGreaterThan(Date.now())
    // 10 days ± 1 minute
    expect(Math.abs(sub!.trialEndsAt! - (Date.now() + 10 * 86400 * 1000))).toBeLessThan(60_000)
  })

  it('rejects duplicate email with 409', async () => {
    await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'B1', adminName: 'X', email: 'dup@x.co', password: 'password123' }),
    })
    const res = await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'B2', adminName: 'Y', email: 'dup@x.co', password: 'password123' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects duplicate brand name case-insensitively with 409', async () => {
    await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'Unique Brand', adminName: 'X', email: 'a@x.co', password: 'password123' }),
    })
    const res = await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'unique brand', adminName: 'Y', email: 'b@x.co', password: 'password123' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects short password with 400', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName: 'B', adminName: 'X', email: 'p@x.co', password: 'short' }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd thrall && npx vitest run tests/routes/signup.test.ts`
Expected: all 4 tests fail (route does not exist → 404).

- [ ] **Step 3: Implement the endpoint**

Append to `thrall/src/routes/auth.ts` (before the `export`, after existing routes):

```ts
import { brands, brandSubscriptions } from '../db/schema'
import { hashPassword } from '../lib/hash'
import { newId } from '../lib/ulid'
import { sql } from 'drizzle-orm'

const signupSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  adminName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
})

const TRIAL_DAYS = 10

authRoutes.post('/signup', zValidator('json', signupSchema), async (c) => {
  const data = c.req.valid('json')

  const emailTaken = await db.query.users.findFirst({ where: eq(users.email, data.email) })
  if (emailTaken) return c.json({ error: 'email_in_use' }, 409)

  const nameTaken = await db.query.brands.findFirst({
    where: sql`lower(${brands.name}) = lower(${data.brandName})`,
  })
  if (nameTaken) return c.json({ error: 'brand_name_in_use' }, 409)

  const now = Date.now()
  const brandId = newId()
  const userId = newId()
  const subId = newId()
  const trialEndsAt = now + TRIAL_DAYS * 86400 * 1000

  await db.insert(brands).values({
    id: brandId, name: data.brandName, isActive: 1, createdAt: now, updatedAt: now,
  })
  await db.insert(brandSubscriptions).values({
    id: subId, brandId,
    tier: 'free', status: 'trial',
    trialEndsAt, paidUntil: null, isGrandfathered: 0,
    createdAt: now, updatedAt: now,
  })
  await db.insert(users).values({
    id: userId, brandId,
    name: data.adminName, email: data.email,
    password: await hashPassword(data.password),
    role: 'admin', isActive: 1,
    createdAt: now, updatedAt: now,
  })

  const token = await signToken({ sub: userId, role: 'admin', brandId, name: data.adminName })
  return c.json({
    token,
    user: { id: userId, name: data.adminName, role: 'admin', brandId },
  })
})
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd thrall && npx vitest run tests/routes/signup.test.ts`
Expected: 4/4 pass.

- [ ] **Step 5: Rebuild bundle**

Run: `cd thrall && npm run build`

- [ ] **Step 6: Commit**

```bash
git add thrall/src/routes/auth.ts thrall/tests/routes/signup.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): public signup endpoint with 10-day trial"
```

---

## Task 3: `requirePaid` middleware + mount on gated routes

**Files:**
- Create: `thrall/src/middleware/requirePaid.ts`
- Modify: `thrall/src/routes/services.ts`, `pay-methods.ts`, `fines.ts`, `loans.ts`, `payments.ts`, `reports.ts`
- Create: `thrall/tests/routes/require-paid.test.ts`

**Interfaces:**
- Consumes: `brandSubscriptions` shape from Task 1; `AppEnv` and `c.get('user')` from `middleware/auth.ts`.
- Produces: exported `requirePaid` async middleware; a helper `computeEffectiveAccess(sub: BrandSubscription): { isPaidEffective: boolean, reason?: 'trial_expired' | 'paid_expired' | 'no_subscription' | 'free' }` used later by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `thrall/tests/routes/require-paid.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function get(path: string, token: string) {
  return app.request(path, { headers: { Authorization: `Bearer ${token}` } })
}

describe('requirePaid middleware', () => {
  it('allows PAID grandfathered brand', async () => {
    const brand = await createTestBrand({ tier: 'paid', status: 'active', isGrandfathered: 1 })
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get('/api/services', token)
    expect(res.status).toBe(200)
  })

  it('allows brand in active trial', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'trial', isGrandfathered: 0,
      trialEndsAt: Date.now() + 86400 * 1000,
    })
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get('/api/services', token)
    expect(res.status).toBe(200)
  })

  it('denies FREE brand with expired trial', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'trial', isGrandfathered: 0,
      trialEndsAt: Date.now() - 1000,
    })
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get('/api/services', token)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('subscription_required')
    expect(body.reason).toBe('trial_expired')
  })

  it('dev role bypasses gate', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'dev' })
    const token = await tokenFor(u.id, 'dev', brand)
    const res = await get('/api/services', token)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

Run: `cd thrall && npx vitest run tests/routes/require-paid.test.ts`
Expected: 3/4 fail (currently no gating; the "denies" test fails because the route still returns 200).

- [ ] **Step 3: Implement the middleware**

Create `thrall/src/middleware/requirePaid.ts`:

```ts
import type { Context, Next } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { brandSubscriptions } from '../db/schema'
import type { AppEnv } from './auth'

type Sub = typeof brandSubscriptions.$inferSelect

export type AccessResult =
  | { isPaidEffective: true }
  | { isPaidEffective: false; reason: 'trial_expired' | 'paid_expired' | 'no_subscription' | 'free' }

export function computeEffectiveAccess(sub: Sub | undefined, now = Date.now()): AccessResult {
  if (!sub) return { isPaidEffective: false, reason: 'no_subscription' }
  if (sub.isGrandfathered === 1) return { isPaidEffective: true }
  if (sub.status === 'trial' && sub.trialEndsAt && sub.trialEndsAt > now) return { isPaidEffective: true }
  if (sub.tier === 'paid' && sub.status === 'active' && sub.paidUntil && sub.paidUntil > now) {
    return { isPaidEffective: true }
  }
  if (sub.status === 'trial' && sub.trialEndsAt && sub.trialEndsAt <= now) {
    return { isPaidEffective: false, reason: 'trial_expired' }
  }
  if (sub.tier === 'paid' && sub.paidUntil && sub.paidUntil <= now) {
    return { isPaidEffective: false, reason: 'paid_expired' }
  }
  return { isPaidEffective: false, reason: 'free' }
}

export async function loadBrandAccess(brandId: string): Promise<AccessResult & { sub?: Sub }> {
  const sub = await db.query.brandSubscriptions.findFirst({
    where: eq(brandSubscriptions.brandId, brandId),
  })
  const now = Date.now()
  const result = computeEffectiveAccess(sub, now)

  // Lazy flip to 'expired' when we notice it.
  if (!result.isPaidEffective && sub && sub.status !== 'expired'
      && (result.reason === 'trial_expired' || result.reason === 'paid_expired')) {
    await db.update(brandSubscriptions)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(brandSubscriptions.id, sub.id))
  }
  return { ...result, sub }
}

export async function requirePaid(c: Context<AppEnv>, next: Next) {
  const user = c.get('user')
  if (user.role === 'dev') return next()
  const access = await loadBrandAccess(user.brandId)
  if (access.isPaidEffective) return next()
  return c.json({ error: 'subscription_required', reason: (access as any).reason }, 403)
}
```

- [ ] **Step 4: Mount on gated route files**

For each of `thrall/src/routes/{services,pay-methods,fines,loans,payments,reports}.ts`, find the existing line that mounts `authMiddleware` (typically `<name>Routes.use('*', authMiddleware, ...)`), and append `requirePaid` to the middleware chain. Example for `services.ts`:

```ts
import { requirePaid } from '../middleware/requirePaid'
// ...
servicesRoutes.use('*', authMiddleware, requirePaid)
```

Do this in all six files. If a file uses `requireRole(...)` too, keep it: `.use('*', authMiddleware, requirePaid, requireRole('admin', ...))`.

- [ ] **Step 5: Run new + full test suite**

Run: `cd thrall && npm test`
Expected: all pass. Existing tests use `createTestBrand()` which defaults to grandfathered PAID, so they continue to pass.

- [ ] **Step 6: Rebuild bundle**

Run: `cd thrall && npm run build`

- [ ] **Step 7: Commit**

```bash
git add thrall/src/middleware/requirePaid.ts thrall/src/routes/*.ts thrall/tests/routes/require-paid.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): requirePaid middleware gates accounting routes"
```

---

## Task 4: `GET /api/brand/subscription` + `POST /api/brand/subscribe` stub

**Files:**
- Create: `thrall/src/routes/brand.ts`
- Modify: `thrall/src/app.ts` (mount new route)
- Create: `thrall/tests/routes/brand.test.ts`

**Interfaces:**
- Consumes: `loadBrandAccess` from Task 3.
- Produces:
  - `GET /api/brand/subscription` → `{ tier, status, trialEndsAt, paidUntil, isGrandfathered, isPaidEffective, daysLeft }`.
  - `POST /api/brand/subscribe` → `501 { error: 'not_implemented' }` (Wompi hook placeholder).

- [ ] **Step 1: Write failing tests**

Create `thrall/tests/routes/brand.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

describe('GET /api/brand/subscription', () => {
  it('returns state with daysLeft for trial brand', async () => {
    const trialEndsAt = Date.now() + 5 * 86400 * 1000
    const brand = await createTestBrand({
      tier: 'free', status: 'trial', trialEndsAt, isGrandfathered: 0,
    })
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await app.request('/api/brand/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tier).toBe('free')
    expect(body.status).toBe('trial')
    expect(body.isPaidEffective).toBe(true)
    expect(body.daysLeft).toBeGreaterThanOrEqual(4)
    expect(body.daysLeft).toBeLessThanOrEqual(5)
  })

  it('returns isPaidEffective=true for grandfathered brand with null daysLeft', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await app.request('/api/brand/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    expect(body.isPaidEffective).toBe(true)
    expect(body.daysLeft).toBeNull()
  })
})

describe('POST /api/brand/subscribe', () => {
  it('returns 501 stub', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await app.request('/api/brand/subscribe', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error).toBe('not_implemented')
  })
})
```

- [ ] **Step 2: Run to confirm failures**

Run: `cd thrall && npx vitest run tests/routes/brand.test.ts`
Expected: all 3 fail (route not mounted).

- [ ] **Step 3: Implement the route**

Create `thrall/src/routes/brand.ts`:

```ts
import { Hono } from 'hono'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { loadBrandAccess } from '../middleware/requirePaid'

export const brandRoutes = new Hono<AppEnv>()
brandRoutes.use('*', authMiddleware)

brandRoutes.get('/subscription', async (c) => {
  const user = c.get('user')
  const { sub, isPaidEffective } = await loadBrandAccess(user.brandId)
  if (!sub) {
    return c.json({
      tier: 'free', status: 'expired',
      trialEndsAt: null, paidUntil: null,
      isGrandfathered: false, isPaidEffective: false, daysLeft: null,
    })
  }
  const now = Date.now()
  const activeAt = sub.status === 'trial' ? sub.trialEndsAt
                 : sub.tier === 'paid'    ? sub.paidUntil
                 : null
  const daysLeft = activeAt && activeAt > now
    ? Math.ceil((activeAt - now) / (86400 * 1000))
    : null
  return c.json({
    tier: sub.tier,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    paidUntil: sub.paidUntil,
    isGrandfathered: sub.isGrandfathered === 1,
    isPaidEffective,
    daysLeft,
  })
})

brandRoutes.post('/subscribe', async (c) => {
  return c.json({ error: 'not_implemented' }, 501)
})
```

- [ ] **Step 4: Mount in `thrall/src/app.ts`**

Add import and mount:

```ts
import { brandRoutes } from './routes/brand'
// ...
app.route('/brand', brandRoutes)
```

- [ ] **Step 5: Run tests**

Run: `cd thrall && npx vitest run tests/routes/brand.test.ts`
Expected: 3/3 pass.

- [ ] **Step 6: Rebuild bundle and commit**

```bash
cd thrall && npm run build
git add thrall/src/routes/brand.ts thrall/src/app.ts thrall/tests/routes/brand.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): expose brand subscription state + subscribe stub"
```

---

## Task 5: Guard admin/monitor creation for FREE brands in `/api/users`

**Files:**
- Modify: `thrall/src/routes/users.ts` (the `POST` handler)
- Create: `thrall/tests/routes/users-tier-gate.test.ts`

**Interfaces:**
- Consumes: `loadBrandAccess` from Task 3.
- Produces: `POST /api/users` returns `403 { error: 'subscription_required' }` when a non-dev admin of a FREE-effective brand tries to create a user with role `admin` or `monitor`.

- [ ] **Step 1: Write failing tests**

Create `thrall/tests/routes/users-tier-gate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function post(token: string, body: object) {
  return app.request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/users tier gating', () => {
  it('FREE brand admin can create a model', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'expired', isGrandfathered: 0,
    })
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await post(token, {
      name: 'M', email: `m-${Date.now()}@x.co`, password: 'password123', role: 'model',
    })
    expect(res.status).toBe(201)
  })

  it('FREE brand admin cannot create another admin', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'expired', isGrandfathered: 0,
    })
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await post(token, {
      name: 'A2', email: `a-${Date.now()}@x.co`, password: 'password123', role: 'admin',
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('subscription_required')
  })

  it('FREE brand admin cannot create a monitor', async () => {
    const brand = await createTestBrand({
      tier: 'free', status: 'expired', isGrandfathered: 0,
    })
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await post(token, {
      name: 'Mo', email: `mo-${Date.now()}@x.co`, password: 'password123', role: 'monitor',
    })
    expect(res.status).toBe(403)
  })

  it('PAID brand admin can create admins and monitors', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(admin.id, 'admin', brand)
    const res = await post(token, {
      name: 'A2', email: `pa-${Date.now()}@x.co`, password: 'password123', role: 'admin',
    })
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Run to confirm failures**

Run: `cd thrall && npx vitest run tests/routes/users-tier-gate.test.ts`
Expected: 2 fail (the "cannot create" ones return 201 today).

- [ ] **Step 3: Add the gate**

In `thrall/src/routes/users.ts`, inside `usersRoutes.post('/', ...)`, right after the `data.role === 'dev'` block, add:

```ts
if (caller.role !== 'dev' && (data.role === 'admin' || data.role === 'monitor')) {
  const { loadBrandAccess } = await import('../middleware/requirePaid')
  const access = await loadBrandAccess(caller.brandId)
  if (!access.isPaidEffective) {
    return c.json({ error: 'subscription_required', reason: (access as any).reason }, 403)
  }
}
```

(Use a top-level import instead of dynamic if you prefer; the dynamic form avoids a circular import risk at boot.)

- [ ] **Step 4: Run tests**

Run: `cd thrall && npx vitest run tests/routes/users-tier-gate.test.ts`
Expected: 4/4 pass.

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/routes/users.ts thrall/tests/routes/users-tier-gate.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): block admin/monitor creation for FREE brands"
```

---

## Task 6: Sylvanas `useSubscription` hook + context provider

**Files:**
- Create: `sylvanas/lib/subscription-context.tsx`
- Modify: `sylvanas/app/dashboard/layout.tsx` (wrap children with the provider — check the file path; if the layout is at `sylvanas/app/dashboard/layout.tsx` use it, otherwise use `app/(dashboard)/layout.tsx` etc.)

**Interfaces:**
- Consumes: `GET /api/brand/subscription` from Task 4.
- Produces: `useSubscription()` hook returning `{ tier, status, trialEndsAt, paidUntil, isGrandfathered, isPaidEffective, daysLeft, loading, refetch }`. Wrapped in `<SubscriptionProvider>`.

- [ ] **Step 1: Create the context**

Create `sylvanas/lib/subscription-context.tsx`:

```tsx
"use client"
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { apiFetch } from "./api" // existing helper that attaches the token

export type SubscriptionState = {
  tier: 'free' | 'paid'
  status: 'active' | 'trial' | 'expired'
  trialEndsAt: number | null
  paidUntil: number | null
  isGrandfathered: boolean
  isPaidEffective: boolean
  daysLeft: number | null
}

type Ctx = SubscriptionState & { loading: boolean; refetch: () => Promise<void> }

const SubscriptionContext = createContext<Ctx | null>(null)

const DEFAULT: SubscriptionState = {
  tier: 'free', status: 'expired',
  trialEndsAt: null, paidUntil: null,
  isGrandfathered: false, isPaidEffective: false, daysLeft: null,
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(DEFAULT)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/brand/subscription')
      if (res.ok) setState(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return (
    <SubscriptionContext.Provider value={{ ...state, loading, refetch }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider")
  return ctx
}
```

If `apiFetch` in `sylvanas/lib/api.ts` has a different shape (e.g. auto-throws), adapt the `res.ok` branching accordingly by reading the file first.

- [ ] **Step 2: Wrap dashboard layout with the provider**

Open `sylvanas/app/dashboard/layout.tsx` (or wherever the dashboard shell lives). Import and wrap children:

```tsx
import { SubscriptionProvider } from "@/lib/subscription-context"
// ...
return (
  <SubscriptionProvider>
    {/* existing shell */}
    {children}
  </SubscriptionProvider>
)
```

- [ ] **Step 3: Smoke test manually**

Run: `cd sylvanas && npm run dev`
Open the dashboard as an existing (grandfathered) user. In DevTools console: `fetch('/api/brand/subscription')` should return 200 (through your proxy) or navigate the browser tab — verify no runtime errors on load.

- [ ] **Step 4: Commit**

```bash
git add sylvanas/lib/subscription-context.tsx sylvanas/app/dashboard/layout.tsx
git commit -m "feat(sylvanas): subscription context provider"
```

---

## Task 7: Sylvanas `/signup` page + server action

**Files:**
- Create: `sylvanas/app/signup/page.tsx`
- Create: `sylvanas/app/signup/actions.ts` (server action) OR use fetch to a Next route handler — mirror the existing `/login` pattern (`sylvanas/app/login/page.tsx` + `sylvanas/app/login/session.ts`). Read that file first to match style.
- Modify: `sylvanas/middleware.ts` to allow `/signup` when not authenticated (mirroring the `/login` treatment).

**Interfaces:**
- Consumes: `POST /api/auth/signup` from Task 2.
- Produces: `/signup` route that on success sets `arthas_token` cookie (httpOnly) and redirects to `/dashboard`.

- [ ] **Step 1: Read the existing login flow**

Open `sylvanas/app/login/page.tsx` and `sylvanas/app/login/session.ts` to see how the cookie is set. Copy the same pattern (server action or route handler) for signup — do not diverge.

- [ ] **Step 2: Create the signup page**

Create `sylvanas/app/signup/page.tsx` (Client Component form; server action for the POST):

```tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signupAction } from "./actions"

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true); setError(null)
    const fd = new FormData(e.currentTarget)
    if (fd.get('password') !== fd.get('confirm')) {
      setPending(false); setError('Las contraseñas no coinciden'); return
    }
    const res = await signupAction(fd)
    setPending(false)
    if (res.ok) router.push('/dashboard')
    else setError(res.error)
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold mb-2">Crea tu agencia</h1>
      <p className="text-sm text-neutral-500 mb-6">10 días de prueba con acceso completo.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="brandName" required placeholder="Nombre de la agencia" className="w-full border rounded p-2" />
        <input name="adminName" required placeholder="Tu nombre" className="w-full border rounded p-2" />
        <input name="email" type="email" required placeholder="Email" className="w-full border rounded p-2" />
        <input name="password" type="password" required minLength={8} placeholder="Contraseña (mín 8)" className="w-full border rounded p-2" />
        <input name="confirm" type="password" required minLength={8} placeholder="Confirmar contraseña" className="w-full border rounded p-2" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={pending} className="w-full rounded bg-black text-white p-2 disabled:opacity-50">
          {pending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Create the server action**

Create `sylvanas/app/signup/actions.ts`:

```ts
"use server"
import { cookies } from "next/headers"

const COOKIE_NAME = "arthas_token"

export async function signupAction(fd: FormData): Promise<{ ok: true } | { ok: false, error: string }> {
  const body = {
    brandName: String(fd.get('brandName') ?? ''),
    adminName: String(fd.get('adminName') ?? ''),
    email: String(fd.get('email') ?? ''),
    password: String(fd.get('password') ?? ''),
  }
  const res = await fetch(`${process.env.THRALL_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const map: Record<string, string> = {
      email_in_use: 'Ese email ya está registrado',
      brand_name_in_use: 'Ese nombre de agencia ya existe',
    }
    return { ok: false, error: map[err.error] ?? 'No se pudo crear la cuenta' }
  }
  const { token } = await res.json()
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/',
  })
  return { ok: true }
}
```

- [ ] **Step 4: Allow `/signup` in middleware**

Edit `sylvanas/middleware.ts`. Extend the redirect-when-authenticated block:

```ts
if ((pathname === "/login" || pathname === "/signup") && (await isValid(token))) {
  return NextResponse.redirect(new URL("/dashboard/services", request.url))
}
```

And extend the matcher:

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
}
```

- [ ] **Step 5: Manual smoke test**

Run: `cd sylvanas && npm run dev` and `cd thrall && npm run dev` in another terminal (or point sylvanas `THRALL_URL` at prod).
Navigate to `http://localhost:3000/signup`, fill the form with new email + brand name, submit. Expected: redirect to `/dashboard`; new brand row + user row present in Turso.

- [ ] **Step 6: Commit**

```bash
git add sylvanas/app/signup sylvanas/middleware.ts
git commit -m "feat(sylvanas): public signup page with trial provisioning"
```

---

## Task 8: Trial banner in dashboard shell

**Files:**
- Create: `sylvanas/components/shared/TrialBanner.tsx`
- Modify: `sylvanas/app/dashboard/layout.tsx` to render it at the top.

**Interfaces:**
- Consumes: `useSubscription` from Task 6.

- [ ] **Step 1: Implement the banner**

Create `sylvanas/components/shared/TrialBanner.tsx`:

```tsx
"use client"
import { useSubscription } from "@/lib/subscription-context"

export function TrialBanner() {
  const s = useSubscription()
  if (s.loading) return null
  if (s.isGrandfathered) return null

  if (s.status === 'trial' && s.isPaidEffective) {
    return (
      <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm flex items-center justify-between">
        <span>Trial: {s.daysLeft} día{s.daysLeft === 1 ? '' : 's'} restantes.</span>
        <a href="/dashboard/subscribe" className="underline font-medium">Suscribirse</a>
      </div>
    )
  }

  if (!s.isPaidEffective && s.tier === 'free') {
    return (
      <div className="bg-red-100 text-red-900 px-4 py-2 text-sm flex items-center justify-between">
        <span>Tu trial terminó. Muchas funciones están bloqueadas.</span>
        <a href="/dashboard/subscribe" className="underline font-medium">Suscríbete para recuperarlas</a>
      </div>
    )
  }
  return null
}
```

- [ ] **Step 2: Render it in the dashboard layout**

In `sylvanas/app/dashboard/layout.tsx`, inside `<SubscriptionProvider>` and above the main content:

```tsx
import { TrialBanner } from "@/components/shared/TrialBanner"
// ...
<SubscriptionProvider>
  <TrialBanner />
  {/* rest of shell */}
  {children}
</SubscriptionProvider>
```

- [ ] **Step 3: Manual verification**

Sign up a fresh brand (from Task 7) and confirm the amber banner shows on the dashboard. Then, in the DB, set `trial_ends_at` to a past timestamp for that brand, reload — expect red banner.

- [ ] **Step 4: Commit**

```bash
git add sylvanas/components/shared/TrialBanner.tsx sylvanas/app/dashboard/layout.tsx
git commit -m "feat(sylvanas): trial + expired banner in dashboard shell"
```

---

## Task 9: Locked-page wrapper + sidebar 🔒 + upsell for gated sections

**Files:**
- Create: `sylvanas/components/shared/PaidGate.tsx`
- Create: `sylvanas/app/dashboard/subscribe/page.tsx` (upsell CTA page — target of "Suscribirse" links)
- Modify: `sylvanas/components/layout/Sidebar.tsx` (or whatever the sidebar is called — check `components/layout/`) to add 🔒 next to locked entries.
- Modify: each gated dashboard page under `sylvanas/app/dashboard/{services,pay-methods,fines,loans,payments,reports,earnings,brand-earnings,model-earnings,ranking}/page.tsx` — wrap the returned JSX in `<PaidGate>`.

**Interfaces:**
- Consumes: `useSubscription` from Task 6, `POST /api/brand/subscribe` from Task 4.

- [ ] **Step 1: PaidGate wrapper**

Create `sylvanas/components/shared/PaidGate.tsx`:

```tsx
"use client"
import type { ReactNode } from "react"
import { useSubscription } from "@/lib/subscription-context"
import { UpsellCard } from "./UpsellCard"

export function PaidGate({ children }: { children: ReactNode }) {
  const s = useSubscription()
  if (s.loading) return null
  if (s.isPaidEffective) return <>{children}</>
  return <UpsellCard reason={s.status === 'expired' ? 'trial_expired' : 'free'} />
}
```

- [ ] **Step 2: UpsellCard**

Create `sylvanas/components/shared/UpsellCard.tsx`:

```tsx
"use client"
import { useState } from "react"

export function UpsellCard({ reason }: { reason: 'trial_expired' | 'free' }) {
  const [msg, setMsg] = useState<string | null>(null)
  async function onSubscribe() {
    const res = await fetch('/api/brand/subscribe', { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setMsg(body.error === 'not_implemented'
      ? 'Pronto habilitaremos el pago en línea.'
      : 'Solicitud recibida.')
  }
  return (
    <div className="mx-auto max-w-xl mt-16 rounded-lg border p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">Esta sección es para suscriptores</h2>
      <p className="text-neutral-600 mb-4">
        {reason === 'trial_expired'
          ? 'Tu trial terminó. Suscríbete para volver a usar el sistema contable.'
          : 'Suscríbete para desbloquear el sistema contable completo.'}
      </p>
      <ul className="text-sm text-neutral-600 mb-6 space-y-1">
        <li>Registro de servicios y extras</li>
        <li>Multas, préstamos y liquidaciones</li>
        <li>Reportes de ganancias</li>
        <li>Monitores y admins adicionales</li>
      </ul>
      <button onClick={onSubscribe} className="rounded bg-black text-white px-4 py-2">Suscribirse</button>
      {msg && <p className="text-sm text-neutral-500 mt-3">{msg}</p>}
    </div>
  )
}
```

Note: `fetch('/api/brand/subscribe')` requires that sylvanas proxies to thrall — if the current fetch pattern uses `apiFetch(...)` with `THRALL_URL`, use that helper instead (read `sylvanas/lib/api.ts` first and match).

- [ ] **Step 3: Subscribe landing page**

Create `sylvanas/app/dashboard/subscribe/page.tsx`:

```tsx
import { UpsellCard } from "@/components/shared/UpsellCard"
export default function SubscribePage() {
  return <UpsellCard reason="free" />
}
```

- [ ] **Step 4: Wrap gated pages**

For each of `sylvanas/app/dashboard/{services,pay-methods,fines,loans,payments,reports,earnings,brand-earnings,model-earnings,ranking}/page.tsx`, wrap the returned tree:

```tsx
import { PaidGate } from "@/components/shared/PaidGate"
// ...
export default function Page() {
  return (
    <PaidGate>
      {/* existing content */}
    </PaidGate>
  )
}
```

If a page is a Server Component today, either convert to a thin Client wrapper that imports the existing content, or move `<PaidGate>` down inside the client tree — do NOT make server components import a hook. Simplest: add a small `"use client"` wrapper file per page importing the old page as content.

- [ ] **Step 5: Sidebar 🔒**

Read `sylvanas/components/layout/` to find the sidebar file. In it, for each nav entry that maps to a gated section, add a 🔒 icon suffix when `!useSubscription().isPaidEffective`. Example:

```tsx
"use client"
import { useSubscription } from "@/lib/subscription-context"
// existing imports

const GATED = new Set(['/dashboard/services', '/dashboard/pay-methods', '/dashboard/fines',
  '/dashboard/loans', '/dashboard/payments', '/dashboard/reports',
  '/dashboard/earnings', '/dashboard/brand-earnings', '/dashboard/model-earnings',
  '/dashboard/ranking'])

// inside the nav render:
{items.map(item => {
  const locked = GATED.has(item.href) && !sub.isPaidEffective
  return (
    <Link key={item.href} href={item.href}>
      <span>{item.label}</span>
      {locked && <span className="ml-2 opacity-60">🔒</span>}
    </Link>
  )
})}
```

- [ ] **Step 6: Manual verification**

Run sylvanas + thrall locally with a FREE-expired brand (created via signup, then trial_ends_at manually set to past). Confirm: sidebar shows 🔒 next to gated entries; visiting any gated page shows the upsell card; visiting `/dashboard/models` still works.

- [ ] **Step 7: Commit**

```bash
git add sylvanas/components/shared sylvanas/app/dashboard/subscribe sylvanas/app/dashboard sylvanas/components/layout
git commit -m "feat(sylvanas): PaidGate wrapper, upsell card, and sidebar locks"
```

---

## Task 10: Sylvanas — gate role options in Users form

**Files:**
- Modify: the "Create user" form under `sylvanas/app/dashboard/users/` (find the component; likely `page.tsx` or a subcomponent).

**Interfaces:**
- Consumes: `useSubscription` from Task 6.

- [ ] **Step 1: Filter the role options**

In the users create/edit form, replace the role `<select>` options with a computed list:

```tsx
"use client"
import { useSubscription } from "@/lib/subscription-context"
// ...
const sub = useSubscription()
const roles = sub.isPaidEffective
  ? [{ v: 'admin', l: 'Admin' }, { v: 'monitor', l: 'Monitor' }, { v: 'model', l: 'Modelo' }]
  : [{ v: 'model', l: 'Modelo' }]
// render <option value={r.v}>{r.l}</option>
```

Below the select, when `!sub.isPaidEffective`, show a hint:

```tsx
{!sub.isPaidEffective && (
  <p className="text-xs text-neutral-500 mt-1">
    Solo puedes crear modelos en el plan gratuito. <a href="/dashboard/subscribe" className="underline">Suscribirse</a> para agregar admins y monitores.
  </p>
)}
```

- [ ] **Step 2: Manual verification**

As a FREE-expired brand admin, open the users page → open "Crear usuario" → confirm only "Modelo" is available. As a PAID admin, all three appear.

- [ ] **Step 3: Commit**

```bash
git add sylvanas/app/dashboard/users
git commit -m "feat(sylvanas): hide admin/monitor role for FREE brands in users form"
```

---

## Task 11: Illidan "Forma parte" CTA

**Files:**
- Modify: illidan navbar component (find under `illidan/components/` or `illidan/app/`).
- Modify: illidan footer if you want the CTA there too.
- Modify: `illidan/.env.example` (or equivalent) to declare `SYLVANAS_URL`.

**Interfaces:**
- Consumes: `SYLVANAS_URL` env var; no thrall calls.

- [ ] **Step 1: Add the env var**

Add to `illidan/.env.example`:

```
SYLVANAS_URL=https://sylvanas.example.com
```

Document in `illidan/README.md` if such a section exists.

- [ ] **Step 2: Add the CTA to the navbar**

Locate the navbar (e.g. `illidan/components/Navbar.tsx` — search with `grep -r "nav" illidan/components illidan/app`). Add a right-aligned link:

```tsx
<a
  href={`${process.env.NEXT_PUBLIC_SYLVANAS_URL}/signup`}
  className="ml-auto rounded bg-white text-black px-3 py-1 text-sm font-medium"
>
  Forma parte
</a>
```

Since Next.js only exposes env vars with `NEXT_PUBLIC_` prefix to the client, update the env name accordingly: rename `SYLVANAS_URL` to `NEXT_PUBLIC_SYLVANAS_URL` in the .env.example. Set the value in Vercel for both preview and production.

- [ ] **Step 3: Manual verification**

Run `cd illidan && npm run dev`. Confirm the CTA appears in the navbar and clicking it navigates to `${SYLVANAS_URL}/signup`.

- [ ] **Step 4: Commit**

```bash
git add illidan/components illidan/.env.example illidan/README.md
git commit -m "feat(illidan): Forma parte CTA linking to sylvanas signup"
```

---

## Task 12: End-to-end smoke + prod migration

**Files:** none.

- [ ] **Step 1: Run all thrall tests**

Run: `cd thrall && npm test`
Expected: all suites pass, including the four new ones (signup, require-paid, brand, users-tier-gate).

- [ ] **Step 2: Run sylvanas tests**

Run: `cd sylvanas && npm test`
Expected: all pass; no new tests required for this plan, but existing suite must not regress.

- [ ] **Step 3: Apply migration to prod Turso**

Run: `cd thrall && npm run db:migrate` against the prod URL/token (env `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`).
Expected: `0002_multi_tenancy_tiers.sql` applied. Verify by querying `SELECT tier, status, is_grandfathered FROM brand_subscriptions;` — the existing brand should be `paid / active / 1`.

- [ ] **Step 4: Verify deploys**

Ensure `thrall/dist/index.mjs` is committed and pushed; Vercel will redeploy thrall from the pushed commit. Deploy sylvanas and illidan (Vercel Root Directory per project).

- [ ] **Step 5: Prod smoke**

- Sign up a new test brand via `https://<sylvanas>/signup` → land on dashboard → banner shows "Trial: 10 días".
- Try to visit `/dashboard/services` as that brand → content loads (trial gives full access).
- In Turso, `UPDATE brand_subscriptions SET trial_ends_at = 1 WHERE brand_id = '<new brand>';` → reload dashboard → red banner + `/dashboard/services` shows upsell.
- Confirm existing brand (grandfathered) works exactly as before, with no banner and no 🔒 icons.

- [ ] **Step 6: Delete the test brand**

```sql
DELETE FROM users WHERE brand_id = '<test>';
DELETE FROM brand_subscriptions WHERE brand_id = '<test>';
DELETE FROM brands WHERE id = '<test>';
```

Done.

---

## Self-Review Notes (author)

- Spec coverage: signup ✓ (T2/T7), trial ✓ (T1/T2 default), gating in thrall ✓ (T3/T5), gating in sylvanas UI ✓ (T9/T10), banner ✓ (T8), subscribe stub ✓ (T4), illidan CTA ✓ (T11), grandfather migration ✓ (T1), tests ✓ (T2/T3/T4/T5).
- No placeholders remain; every code step has full code.
- Type consistency: `computeEffectiveAccess` result shape is used the same way in T3 (middleware) and T4 (subscription endpoint) and T5 (users guard).
- Sylvanas file paths (`sylvanas/lib/api.ts`, `sylvanas/app/dashboard/layout.tsx`, sidebar file) are called out as "read first and match" where the exact filename wasn't verified — this is intentional so the implementer confirms before editing.
