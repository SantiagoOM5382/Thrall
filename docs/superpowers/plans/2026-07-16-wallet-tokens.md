# Wallet & Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the second monetization stream (tokens spent on visibility boosts) on top of the Wompi checkout/webhook infrastructure already built for subscriptions.

**Architecture:** `products.type = 'TOKEN_PACK'` rows reuse the existing checkout flow unchanged. A new `brand_wallets` + `wallet_transactions` pair tracks token balance and its audit trail, per brand. `top_services` is a small catalog of things tokens buy; `profile_boosts` records an active/expired boost on a model. The Wompi webhook's `APPROVED` branch is extended to credit the wallet instead of extending `paidUntil` when the purchased product is a `TOKEN_PACK`. A new `POST /api/models/:id/boost` debits the wallet and creates a boost. `GET /api/models` (public, consumed by illidan) sorts boosted models first.

**Tech Stack:** Same as the Wompi plan — Hono, Drizzle, libsql/Turso, Vitest (thrall); Next.js 15 App Router, Tailwind, Vitest (sylvanas); plain Next.js (illidan, no auth).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-16-wallet-tokens.md`.
- Token pack codes/values (confirm before prod seed, currently placeholders from the original product doc): `tokens_100` $10.000 / 100 tokens, `tokens_500` $40.000 / 500 tokens, `tokens_1500` $100.000 / 1500 tokens.
- Discount percents by subscription plan: `sub_monthly` 20%, `sub_semester` 35%, `sub_annual` 60%. Applied via `applyDiscount(priceCop, percent) = round(priceCop * (1 - percent/100))`.
- Discount resolution: look up the brand's most recent `APPROVED` `SUBSCRIPTION` purchase, read `product.tokenDiscountPercent` from it. No subscription purchase ever approved → 0%. Never store this on `brand_subscriptions`.
- `top_services` seed (placeholder, confirm before prod seed): `top_perfil_24h` — 50 tokens, 24h duration.
- `profile_boosts` has no `status` column — "active" is `endsAt > now()` computed at read time, never written by a job.
- Webhook idempotency is unchanged — the existing `TERMINAL.has(purchase.status)` guard in `webhooks.ts` already covers both product types since it runs before the type branch.
- All wallet-balance mutations (webhook credit, boost debit) run inside `db.transaction()`, reading the current balance inside the transaction to avoid lost-update races.
- After thrall src changes: `cd thrall && npm run build` + commit regenerated `dist/index.mjs`.
- Sylvanas: no Next/SWC bumps.
- Do NOT push to origin from tasks (final rollout is user-driven).
- Do NOT skip hooks.
- `dev` role bypasses `requirePaid` (unchanged, not touched by this plan).

---

## Task 1: Schema extension + migration 0005

**Files:**
- Modify: `thrall/src/db/schema.ts` (extend `products`, add 4 tables)
- Create: `thrall/migrations/0005_wallet_tokens.sql`
- Modify: `thrall/migrations/meta/_journal.json`

**Interfaces produced:**
- `products.tokenDiscountPercent` (nullable integer).
- `brandWallets`, `topServices`, `profileBoosts`, `walletTransactions` Drizzle tables.
- Seeded 3 `TOKEN_PACK` products, 1 `top_services` row, and `tokenDiscountPercent` backfilled on the 3 existing `SUBSCRIPTION` products.

- [ ] **Step 1: Extend `products` and add the 4 tables**

In `thrall/src/db/schema.ts`, find the existing `products` table (added in the Wompi plan) and add one column:

```ts
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  type: text('type', { enum: ['SUBSCRIPTION', 'TOKEN_PACK'] }).notNull(),
  displayName: text('display_name').notNull(),
  priceCop: integer('price_cop').notNull(),
  durationDays: integer('duration_days'),
  tokensGranted: integer('tokens_granted'),
  tokenDiscountPercent: integer('token_discount_percent'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  codeIdx: uniqueIndex('products_code_idx').on(t.code),
}))
```

(Only the `tokenDiscountPercent` line is new — keep the rest identical.)

Immediately below the existing `purchases` table (after its closing `}))`), add:

```ts
export const brandWallets = sqliteTable('brand_wallets', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  tokensBalance: integer('tokens_balance').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  brandIdx: uniqueIndex('brand_wallets_brand_idx').on(t.brandId),
}))

export const topServices = sqliteTable('top_services', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  displayName: text('display_name').notNull(),
  tokensCost: integer('tokens_cost').notNull(),
  durationHours: integer('duration_hours').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  codeIdx: uniqueIndex('top_services_code_idx').on(t.code),
}))

export const profileBoosts = sqliteTable('profile_boosts', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull().references(() => users.id),
  brandId: text('brand_id').notNull().references(() => brands.id),
  purchasedBy: text('purchased_by').notNull().references(() => users.id),
  topServiceId: text('top_service_id').notNull().references(() => topServices.id),
  tokensSpent: integer('tokens_spent').notNull(),
  startsAt: integer('starts_at').notNull(),
  endsAt: integer('ends_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  modelEndsIdx: index('profile_boosts_model_ends_idx').on(t.modelId, t.endsAt),
  brandCreatedIdx: index('profile_boosts_brand_created_idx').on(t.brandId, t.createdAt),
}))

export const walletTransactions = sqliteTable('wallet_transactions', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  type: text('type', { enum: ['CREDIT_PURCHASE', 'DEBIT_BOOST'] }).notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  purchaseId: text('purchase_id').references(() => purchases.id),
  profileBoostId: text('profile_boost_id').references(() => profileBoosts.id),
  description: text('description').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  brandCreatedIdx: index('wallet_transactions_brand_created_idx').on(t.brandId, t.createdAt),
}))
```

`index` is already imported (added in the Wompi plan's Task 1). No new imports needed.

- [ ] **Step 2: Write migration SQL**

Create `thrall/migrations/0005_wallet_tokens.sql`:

```sql
ALTER TABLE products ADD COLUMN token_discount_percent INTEGER;
--> statement-breakpoint
UPDATE products SET token_discount_percent = 20 WHERE code = 'sub_monthly';
--> statement-breakpoint
UPDATE products SET token_discount_percent = 35 WHERE code = 'sub_semester';
--> statement-breakpoint
UPDATE products SET token_discount_percent = 60 WHERE code = 'sub_annual';
--> statement-breakpoint
CREATE TABLE brand_wallets (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  tokens_balance INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX brand_wallets_brand_idx ON brand_wallets(brand_id);
--> statement-breakpoint
CREATE TABLE top_services (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tokens_cost INTEGER NOT NULL,
  duration_hours INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX top_services_code_idx ON top_services(code);
--> statement-breakpoint
CREATE TABLE profile_boosts (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES users(id),
  brand_id TEXT NOT NULL REFERENCES brands(id),
  purchased_by TEXT NOT NULL REFERENCES users(id),
  top_service_id TEXT NOT NULL REFERENCES top_services(id),
  tokens_spent INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX profile_boosts_model_ends_idx ON profile_boosts(model_id, ends_at);
--> statement-breakpoint
CREATE INDEX profile_boosts_brand_created_idx ON profile_boosts(brand_id, created_at);
--> statement-breakpoint
CREATE TABLE wallet_transactions (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  purchase_id TEXT REFERENCES purchases(id),
  profile_boost_id TEXT REFERENCES profile_boosts(id),
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX wallet_transactions_brand_created_idx ON wallet_transactions(brand_id, created_at);
--> statement-breakpoint
INSERT INTO products (id, code, type, display_name, price_cop, tokens_granted, is_active, created_at, updated_at) VALUES
  ('prod_tokens_100',  'tokens_100',  'TOKEN_PACK', '100 tokens',  10000,  100,  1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('prod_tokens_500',  'tokens_500',  'TOKEN_PACK', '500 tokens',  40000,  500,  1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('prod_tokens_1500', 'tokens_1500', 'TOKEN_PACK', '1500 tokens', 100000, 1500, 1, strftime('%s','now')*1000, strftime('%s','now')*1000);
--> statement-breakpoint
INSERT INTO top_services (id, code, display_name, tokens_cost, duration_hours, is_active, created_at, updated_at) VALUES
  ('svc_top_perfil_24h', 'top_perfil_24h', 'Top perfil 24 horas', 50, 24, 1, strftime('%s','now')*1000, strftime('%s','now')*1000);
```

- [ ] **Step 3: Register the migration**

Add an entry to `thrall/migrations/meta/_journal.json` after `0004_products_and_purchases`: `idx: 5`, `tag: "0005_wallet_tokens"`, `breakpoints: true`, `when` = current millis. Follow the exact shape of the existing entries.

- [ ] **Step 4: Apply migration locally + run suite**

```
cd thrall && npm run db:migrate
```
Expected: `SELECT COUNT(*) FROM products WHERE type='TOKEN_PACK';` → 3. `SELECT COUNT(*) FROM top_services;` → 1.

```
cd thrall && npm test
```
Expected: same pass count as before this task (no regressions; no new tests yet). The existing timezone flake (unrelated, pre-existing) may still fail.

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/db/schema.ts thrall/migrations/0005_wallet_tokens.sql thrall/migrations/meta/_journal.json thrall/dist/index.mjs
git commit -m "feat(thrall): wallet, boosts, token-pack schema + seed"
```

---

## Task 2: `lib/wallet.ts` pure helpers with unit tests

**Files:**
- Create: `thrall/src/lib/wallet.ts`
- Create: `thrall/tests/lib/wallet.test.ts`

**Interfaces produced:**
- `applyDiscount(priceCop: number, discountPercent: number | null | undefined): number`
- `computeBoostExpiry(now: number, durationHours: number): number`

- [ ] **Step 1: Write failing unit tests**

Create `thrall/tests/lib/wallet.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyDiscount, computeBoostExpiry } from '../../src/lib/wallet'

describe('applyDiscount', () => {
  it('applies no discount when percent is null/undefined', () => {
    expect(applyDiscount(10000, null)).toBe(10000)
    expect(applyDiscount(10000, undefined)).toBe(10000)
  })

  it('applies 20/35/60 percent discounts with rounding', () => {
    expect(applyDiscount(10000, 20)).toBe(8000)
    expect(applyDiscount(40000, 35)).toBe(26000)
    expect(applyDiscount(100000, 60)).toBe(40000)
  })

  it('rounds to the nearest peso', () => {
    expect(applyDiscount(10001, 20)).toBe(8001) // 8000.8 -> 8001
  })
})

describe('computeBoostExpiry', () => {
  it('adds durationHours in ms to now', () => {
    const now = 1_000_000_000_000
    expect(computeBoostExpiry(now, 24)).toBe(now + 24 * 3_600_000)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

`cd thrall && npx vitest run tests/lib/wallet.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

Create `thrall/src/lib/wallet.ts`:

```ts
export function applyDiscount(priceCop: number, discountPercent: number | null | undefined): number {
  const pct = discountPercent ?? 0
  return Math.round(priceCop * (1 - pct / 100))
}

export function computeBoostExpiry(now: number, durationHours: number): number {
  return now + durationHours * 3_600_000
}
```

- [ ] **Step 4: Run tests**

`cd thrall && npx vitest run tests/lib/wallet.test.ts` → PASS (4/4).

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/lib/wallet.ts thrall/tests/lib/wallet.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): wallet helpers (discount math, boost expiry)"
```

---

## Task 3: `GET /api/top-services` public listing

**Files:**
- Create: `thrall/src/routes/top-services.ts`
- Modify: `thrall/src/app.ts`
- Create: `thrall/tests/routes/top-services.test.ts`

- [ ] **Step 1: Failing test**

Create `thrall/tests/routes/top-services.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'

describe('GET /api/top-services', () => {
  it('lists active boost services', async () => {
    const res = await app.request('/api/top-services')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    const codes = body.map((s: { code: string }) => s.code)
    expect(codes).toContain('top_perfil_24h')
    for (const s of body) {
      expect(s.tokensCost).toBeGreaterThan(0)
      expect(s.durationHours).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run to confirm fail** — `npx vitest run tests/routes/top-services.test.ts` → 404, route not mounted.

- [ ] **Step 3: Implement**

Create `thrall/src/routes/top-services.ts`:

```ts
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { topServices } from '../db/schema'

export const topServicesRoutes = new Hono()

topServicesRoutes.get('/', async (c) => {
  const rows = await db
    .select({
      id: topServices.id,
      code: topServices.code,
      displayName: topServices.displayName,
      tokensCost: topServices.tokensCost,
      durationHours: topServices.durationHours,
    })
    .from(topServices)
    .where(eq(topServices.isActive, 1))
  return c.json(rows)
})
```

In `thrall/src/app.ts`, add the import next to `productsRoutes` and mount:

```ts
import { topServicesRoutes } from './routes/top-services'
// ...
app.route('/top-services', topServicesRoutes)
```

- [ ] **Step 4: Run tests** — PASS 1/1.

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/routes/top-services.ts thrall/src/app.ts thrall/tests/routes/top-services.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): GET /api/top-services public listing"
```

---

## Task 4: `GET /api/brand/wallet` + `GET /api/brand/wallet/transactions`

**Files:**
- Modify: `thrall/src/routes/brand.ts`
- Create: `thrall/tests/routes/wallet.test.ts`

**Interfaces produced:**
- `GET /api/brand/wallet` → `{ tokensBalance: number, tokenDiscountPercent: number }`.
- `GET /api/brand/wallet/transactions?limit=&before=` → `{ transactions: WalletTransaction[] }`, newest first, cursor-paginated by `createdAt`.
- Internal helper `resolveTokenDiscountPercent(brandId)` (not exported — used by this task and Task 5).

- [ ] **Step 1: Failing tests**

Create `thrall/tests/routes/wallet.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { purchases, brandWallets, walletTransactions } from '../../src/db/schema'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { newId } from '../../src/lib/ulid'

async function get(path: string, token: string) {
  return app.request(path, { headers: { Authorization: `Bearer ${token}` } })
}

describe('GET /api/brand/wallet', () => {
  it('returns 0 balance and 0% discount for a brand with no purchases', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get('/api/brand/wallet', token)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ tokensBalance: 0, tokenDiscountPercent: 0 })
  })

  it('reflects the balance and resolves discount from the latest approved subscription', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const now = Date.now()
    await db.insert(brandWallets).values({ id: newId(), brandId: brand, tokensBalance: 250, createdAt: now, updatedAt: now })
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_sub_semester', userId: u.id,
      amountCop: 500000, status: 'APPROVED', wompiReference: 'ref-wallet-' + newId(),
      paidAt: now, createdAt: now, updatedAt: now,
    })
    const res = await get('/api/brand/wallet', token)
    const body = await res.json()
    expect(body.tokensBalance).toBe(250)
    expect(body.tokenDiscountPercent).toBe(35)
  })
})

describe('GET /api/brand/wallet/transactions', () => {
  it('returns transactions newest first', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const now = Date.now()
    await db.insert(walletTransactions).values({
      id: newId(), brandId: brand, type: 'CREDIT_PURCHASE', amount: 100,
      balanceAfter: 100, description: 'old', createdAt: now - 1000,
    })
    await db.insert(walletTransactions).values({
      id: newId(), brandId: brand, type: 'DEBIT_BOOST', amount: 50,
      balanceAfter: 50, description: 'new', createdAt: now,
    })
    const res = await get('/api/brand/wallet/transactions', token)
    const body = await res.json()
    expect(body.transactions).toHaveLength(2)
    expect(body.transactions[0].description).toBe('new')
    expect(body.transactions[1].description).toBe('old')
  })
})
```

- [ ] **Step 2: Run to confirm fail** — both 404 (routes not mounted).

- [ ] **Step 3: Implement**

In `thrall/src/routes/brand.ts`, add imports:

```ts
import { and, desc, eq, lt } from 'drizzle-orm'
import { brandWallets, walletTransactions } from '../db/schema'
```

(`and`, `desc`, `eq` already imported from the Wompi plan — add `lt`. Add `brandWallets, walletTransactions` to the existing `products, purchases` import from `'../db/schema'`.)

Add a local helper (near the top of the file, after imports, before route definitions):

```ts
async function resolveTokenDiscountPercent(brandId: string): Promise<number> {
  const latest = await db
    .select({ tokenDiscountPercent: products.tokenDiscountPercent })
    .from(purchases)
    .innerJoin(products, eq(products.id, purchases.productId))
    .where(and(
      eq(purchases.brandId, brandId),
      eq(purchases.status, 'APPROVED'),
      eq(products.type, 'SUBSCRIPTION'),
    ))
    .orderBy(desc(purchases.createdAt))
    .limit(1)
  return latest[0]?.tokenDiscountPercent ?? 0
}
```

Add the two routes (anywhere after `brandRoutes.use('*', authMiddleware)`):

```ts
brandRoutes.get('/wallet', async (c) => {
  const user = c.get('user')
  const wallet = await db.query.brandWallets.findFirst({ where: eq(brandWallets.brandId, user.brandId) })
  const tokenDiscountPercent = await resolveTokenDiscountPercent(user.brandId)
  return c.json({ tokensBalance: wallet?.tokensBalance ?? 0, tokenDiscountPercent })
})

brandRoutes.get('/wallet/transactions', async (c) => {
  const user = c.get('user')
  const limitParam = Number(c.req.query('limit') ?? '20')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20
  const beforeParam = c.req.query('before')
  const conditions = [eq(walletTransactions.brandId, user.brandId)]
  if (beforeParam) conditions.push(lt(walletTransactions.createdAt, Number(beforeParam)))
  const rows = await db
    .select()
    .from(walletTransactions)
    .where(and(...conditions))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit)
  return c.json({ transactions: rows })
})
```

- [ ] **Step 4: Run tests** — PASS 3/3.

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/routes/brand.ts thrall/tests/routes/wallet.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): GET /api/brand/wallet + wallet/transactions"
```

---

## Task 5: `POST /api/brand/purchase-tokens`

**Files:**
- Modify: `thrall/src/routes/brand.ts`
- Create: `thrall/tests/routes/purchase-tokens.test.ts`

**Interfaces:**
- Consumes: `applyDiscount` from `lib/wallet.ts`; `resolveTokenDiscountPercent` from Task 4; `buildCheckoutUrl` (already imported).
- Produces: `POST /api/brand/purchase-tokens { productId }` → `200 { checkoutUrl }`, inserts a `PENDING` `purchases` row with the **discounted** `amountCop`.

- [ ] **Step 1: Failing tests**

Create `thrall/tests/routes/purchase-tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { purchases } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { newId } from '../../src/lib/ulid'

process.env.WOMPI_PUBLIC_KEY ??= 'pub_test_xxx'
process.env.WOMPI_INTEGRITY_SECRET ??= 'integrity_secret_test'
process.env.SYLVANAS_URL ??= 'https://sylvanas.example.com'

async function post(token: string, body: object) {
  return app.request('/api/brand/purchase-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/brand/purchase-tokens', () => {
  it('charges full price with no active subscription discount', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await post(token, { productId: 'prod_tokens_100' })
    expect(res.status).toBe(200)
    const { checkoutUrl } = await res.json()
    const url = new URL(checkoutUrl)
    expect(url.searchParams.get('amount-in-cents')).toBe('1000000') // 10000 * 100, 0% discount
    const ref = url.searchParams.get('reference')!
    const rows = await db.select().from(purchases).where(eq(purchases.wompiReference, ref))
    expect(rows[0].amountCop).toBe(10000)
    expect(rows[0].productId).toBe('prod_tokens_100')
  })

  it('applies the discount from the latest approved subscription', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const now = Date.now()
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_sub_annual', userId: u.id,
      amountCop: 980000, status: 'APPROVED', wompiReference: 'ref-sub-' + newId(),
      paidAt: now, createdAt: now, updatedAt: now,
    })
    const res = await post(token, { productId: 'prod_tokens_500' })
    const { checkoutUrl } = await res.json()
    const url = new URL(checkoutUrl)
    // 40000 * (1 - 0.60) = 16000
    expect(url.searchParams.get('amount-in-cents')).toBe('1600000')
  })

  it('rejects a SUBSCRIPTION productId with 400', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await post(token, { productId: 'prod_sub_monthly' })
    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.request('/api/brand/purchase-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'prod_tokens_100' }),
    })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run to confirm fail** — 404, route not mounted.

- [ ] **Step 3: Implement**

In `thrall/src/routes/brand.ts`, add to imports: `import { applyDiscount } from '../lib/wallet'`.

Add the route (after `/subscribe`, before or after the wallet routes — order doesn't matter):

```ts
const purchaseTokensSchema = z.object({ productId: z.string().min(1) })

brandRoutes.post('/purchase-tokens', zValidator('json', purchaseTokensSchema), async (c) => {
  const user = c.get('user')
  const { productId } = c.req.valid('json')

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.isActive, 1)),
  })
  if (!product || product.type !== 'TOKEN_PACK' || product.tokensGranted == null) {
    return c.json({ error: 'invalid_product' }, 400)
  }

  const pub = process.env.WOMPI_PUBLIC_KEY
  const integrity = process.env.WOMPI_INTEGRITY_SECRET
  const sylvanas = process.env.SYLVANAS_URL
  if (!pub || !integrity || !sylvanas) {
    return c.json({ error: 'wompi_not_configured' }, 500)
  }

  const discountPercent = await resolveTokenDiscountPercent(user.brandId)
  const amountCop = applyDiscount(product.priceCop, discountPercent)

  const reference = newId()
  const now = Date.now()
  await db.insert(purchases).values({
    id: newId(),
    brandId: user.brandId,
    productId: product.id,
    userId: user.sub,
    amountCop,
    status: 'PENDING',
    wompiReference: reference,
    createdAt: now,
    updatedAt: now,
  })

  const checkoutUrl = buildCheckoutUrl({
    publicKey: pub,
    integritySecret: integrity,
    reference,
    amountInCents: amountCop * 100,
    currency: 'COP',
    redirectUrl: `${sylvanas}/dashboard/subscribe/success`,
  })

  return c.json({ checkoutUrl })
})
```

Note it reuses the **same** `redirect-url` as `/subscribe` — the success page is already generic (Task 8 of the Wompi plan built it to read `productCode`/`status` without assuming a type).

- [ ] **Step 4: Run tests** — PASS 4/4.

- [ ] **Step 5: Run full thrall suite, rebuild, commit**

```bash
cd thrall && npm test   # no regressions besides the pre-existing timezone flake
npm run build
git add thrall/src/routes/brand.ts thrall/tests/routes/purchase-tokens.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): POST /api/brand/purchase-tokens with subscription discount"
```

---

## Task 6: Webhook — credit wallet on `TOKEN_PACK` `APPROVED`

**Files:**
- Modify: `thrall/src/routes/webhooks.ts`
- Modify: `thrall/tests/routes/webhook-wompi.test.ts` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `thrall/tests/routes/webhook-wompi.test.ts` (same file/imports as the Wompi plan built; add `brandWallets, walletTransactions` to the existing schema import):

```ts
import { brandWallets, walletTransactions } from '../../src/db/schema'
```

Add new `describe` block at the end of the file:

```ts
describe('POST /api/webhooks/wompi — TOKEN_PACK', () => {
  it('credits the wallet on APPROVED, creating it if missing', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-tok-' + newId()
    const now = Date.now()
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_tokens_100', userId: u.id,
      amountCop: 10000, status: 'PENDING', wompiReference: ref,
      createdAt: now, updatedAt: now,
    })
    const body = buildPayload({ reference: ref, status: 'APPROVED', amountInCents: 1000000 })
    const res = await post(body)
    expect(res.status).toBe(200)

    const wallet = await db.query.brandWallets.findFirst({ where: eq(brandWallets.brandId, brand) })
    expect(wallet?.tokensBalance).toBe(100)

    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.brandId, brand))
    expect(txs).toHaveLength(1)
    expect(txs[0].type).toBe('CREDIT_PURCHASE')
    expect(txs[0].amount).toBe(100)
    expect(txs[0].balanceAfter).toBe(100)

    // Subscription state must be untouched by a token purchase.
    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub?.tier).toBe('free')
  })

  it('adds to an existing balance instead of overwriting it', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const now = Date.now()
    await db.insert(brandWallets).values({ id: newId(), brandId: brand, tokensBalance: 40, createdAt: now, updatedAt: now })
    const ref = 'ref-tok2-' + newId()
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_tokens_500', userId: u.id,
      amountCop: 40000, status: 'PENDING', wompiReference: ref,
      createdAt: now, updatedAt: now,
    })
    const body = buildPayload({ reference: ref, status: 'APPROVED', amountInCents: 4000000 })
    await post(body)
    const wallet = await db.query.brandWallets.findFirst({ where: eq(brandWallets.brandId, brand) })
    expect(wallet?.tokensBalance).toBe(540)
  })
})
```

- [ ] **Step 2: Run to confirm failure** — the new cases fail because the webhook currently assumes every `APPROVED` purchase is a subscription (it will silently no-op for a `TOKEN_PACK` product since `product.durationDays == null` returns early).

- [ ] **Step 3: Implement the branch**

In `thrall/src/routes/webhooks.ts`, add to imports:

```ts
import { purchases, products, brandSubscriptions, brandWallets, walletTransactions } from '../db/schema'
import { newId } from '../lib/ulid'
```

Replace the `if (status === 'APPROVED') { ... }` block inside `db.transaction(async (tx2) => { ... })` with:

```ts
    if (status === 'APPROVED') {
      const product = await tx2.query.products.findFirst({
        where: eq(products.id, purchase.productId),
      })
      if (!product) return

      if (product.type === 'SUBSCRIPTION' && product.durationDays != null) {
        const sub = await tx2.query.brandSubscriptions.findFirst({
          where: eq(brandSubscriptions.brandId, purchase.brandId),
        })
        const newPaidUntil = computeNewPaidUntil(
          { paidUntil: sub?.paidUntil ?? null },
          { durationDays: product.durationDays },
          now,
        )
        if (sub) {
          await tx2.update(brandSubscriptions)
            .set({
              tier: 'paid', status: 'active',
              paidUntil: newPaidUntil, trialEndsAt: null,
              updatedAt: now,
            })
            .where(eq(brandSubscriptions.id, sub.id))
        }
      } else if (product.type === 'TOKEN_PACK' && product.tokensGranted != null) {
        const wallet = await tx2.query.brandWallets.findFirst({
          where: eq(brandWallets.brandId, purchase.brandId),
        })
        const currentBalance = wallet?.tokensBalance ?? 0
        const newBalance = currentBalance + product.tokensGranted

        if (wallet) {
          await tx2.update(brandWallets)
            .set({ tokensBalance: newBalance, updatedAt: now })
            .where(eq(brandWallets.id, wallet.id))
        } else {
          await tx2.insert(brandWallets).values({
            id: newId(), brandId: purchase.brandId, tokensBalance: newBalance,
            createdAt: now, updatedAt: now,
          })
        }

        await tx2.insert(walletTransactions).values({
          id: newId(),
          brandId: purchase.brandId,
          type: 'CREDIT_PURCHASE',
          amount: product.tokensGranted,
          balanceAfter: newBalance,
          purchaseId: purchase.id,
          description: `Compra ${product.displayName}`,
          createdAt: now,
        })
      }
    }
```

- [ ] **Step 4: Run the full webhook test file**

`cd thrall && npx vitest run tests/routes/webhook-wompi.test.ts` → PASS (8/8: 6 existing + 2 new).

- [ ] **Step 5: Run full suite, rebuild, commit**

```bash
cd thrall && npm test
npm run build
git add thrall/src/routes/webhooks.ts thrall/tests/routes/webhook-wompi.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): webhook credits wallet on TOKEN_PACK approval"
```

---

## Task 7: `POST /api/models/:id/boost`

**Files:**
- Modify: `thrall/src/routes/models.ts`
- Create: `thrall/tests/routes/boost.test.ts`

**Interfaces:**
- Consumes: `computeBoostExpiry` from `lib/wallet.ts`.
- Produces: `POST /api/models/:id/boost { topServiceId }` — auth required. `200 { tokensBalance, boost: { id, endsAt } }`. `404` if model doesn't exist or belongs to another brand. `400 invalid_service` / `400 insufficient_tokens`.

- [ ] **Step 1: Failing tests**

Create `thrall/tests/routes/boost.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { brandWallets, profileBoosts, walletTransactions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { newId } from '../../src/lib/ulid'

async function post(token: string, modelId: string, body: object) {
  return app.request(`/api/models/${modelId}/boost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/models/:id/boost', () => {
  it('debits the wallet and creates a boost', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model', email: `m-${newId()}@test.com` })
    const token = await tokenFor(admin.id, 'admin', brand)
    const now = Date.now()
    await db.insert(brandWallets).values({ id: newId(), brandId: brand, tokensBalance: 100, createdAt: now, updatedAt: now })

    const res = await post(token, model.id, { topServiceId: 'svc_top_perfil_24h' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tokensBalance).toBe(50)
    expect(body.boost.endsAt).toBeGreaterThan(now)

    const wallet = await db.query.brandWallets.findFirst({ where: eq(brandWallets.brandId, brand) })
    expect(wallet?.tokensBalance).toBe(50)

    const boosts = await db.select().from(profileBoosts).where(eq(profileBoosts.modelId, model.id))
    expect(boosts).toHaveLength(1)
    expect(boosts[0].tokensSpent).toBe(50)

    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.brandId, brand))
    expect(txs).toHaveLength(1)
    expect(txs[0].type).toBe('DEBIT_BOOST')
  })

  it('rejects with 400 when the wallet balance is insufficient', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model', email: `m-${newId()}@test.com` })
    const token = await tokenFor(admin.id, 'admin', brand)
    // No wallet row at all -> balance 0
    const res = await post(token, model.id, { topServiceId: 'svc_top_perfil_24h' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('insufficient_tokens')
  })

  it('rejects with 404 when the model belongs to another brand', async () => {
    const brandA = await createTestBrand()
    const brandB = await createTestBrand()
    const admin = await createTestUser(brandA, { role: 'admin' })
    const otherModel = await createTestUser(brandB, { role: 'model', email: `m-${newId()}@test.com` })
    const token = await tokenFor(admin.id, 'admin', brandA)
    const res = await post(token, otherModel.id, { topServiceId: 'svc_top_perfil_24h' })
    expect(res.status).toBe(404)
  })

  it('rejects with 400 for an unknown topServiceId', async () => {
    const brand = await createTestBrand()
    const admin = await createTestUser(brand, { role: 'admin' })
    const model = await createTestUser(brand, { role: 'model', email: `m-${newId()}@test.com` })
    const token = await tokenFor(admin.id, 'admin', brand)
    const now = Date.now()
    await db.insert(brandWallets).values({ id: newId(), brandId: brand, tokensBalance: 999, createdAt: now, updatedAt: now })
    const res = await post(token, model.id, { topServiceId: 'does-not-exist' })
    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated request with 401', async () => {
    const brand = await createTestBrand()
    const model = await createTestUser(brand, { role: 'model', email: `m-${newId()}@test.com` })
    const res = await app.request(`/api/models/${model.id}/boost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topServiceId: 'svc_top_perfil_24h' }),
    })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run to confirm fail** — 404 (route not defined) for the first four; the last one currently 404s too instead of 401 (no route at all yet) — that's expected pre-implementation, just confirm all fail/mismatch before implementing.

- [ ] **Step 3: Implement**

`thrall/src/routes/models.ts` currently exports `modelsRoutes = new Hono()` with no auth (both `GET /` and `GET /:id` are public). Change the generic to `Hono<AppEnv>()` so `c.get('user')` is typed on the new route, and add the boost route with **per-route** auth middleware (the GET routes must stay public):

```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../db/client'
import { users, brandWallets, walletTransactions, topServices, profileBoosts } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middleware/auth'
import { newId } from '../lib/ulid'
import { computeBoostExpiry } from '../lib/wallet'

export const modelsRoutes = new Hono<AppEnv>()

class InsufficientTokensError extends Error {}
```

Keep the existing `GET /` and `GET /:id` handlers as-is for now (ordering change is Task 8). Add at the end of the file:

```ts
const boostSchema = z.object({ topServiceId: z.string().min(1) })

modelsRoutes.post('/:id/boost', authMiddleware, zValidator('json', boostSchema), async (c) => {
  const user = c.get('user')
  const { topServiceId } = c.req.valid('json')
  const modelId = c.req.param('id')

  const model = await db.query.users.findFirst({
    where: and(eq(users.id, modelId), eq(users.role, 'model'), eq(users.brandId, user.brandId)),
  })
  if (!model) return c.json({ error: 'not_found' }, 404)

  const service = await db.query.topServices.findFirst({
    where: and(eq(topServices.id, topServiceId), eq(topServices.isActive, 1)),
  })
  if (!service) return c.json({ error: 'invalid_service' }, 400)

  try {
    const result = await db.transaction(async (tx) => {
      const wallet = await tx.query.brandWallets.findFirst({
        where: eq(brandWallets.brandId, user.brandId),
      })
      const currentBalance = wallet?.tokensBalance ?? 0
      if (currentBalance < service.tokensCost) {
        throw new InsufficientTokensError()
      }

      const now = Date.now()
      const endsAt = computeBoostExpiry(now, service.durationHours)
      const newBalance = currentBalance - service.tokensCost
      const boostId = newId()

      if (wallet) {
        await tx.update(brandWallets)
          .set({ tokensBalance: newBalance, updatedAt: now })
          .where(eq(brandWallets.id, wallet.id))
      } else {
        await tx.insert(brandWallets).values({
          id: newId(), brandId: user.brandId, tokensBalance: newBalance,
          createdAt: now, updatedAt: now,
        })
      }

      await tx.insert(profileBoosts).values({
        id: boostId,
        modelId: model.id,
        brandId: user.brandId,
        purchasedBy: user.sub,
        topServiceId: service.id,
        tokensSpent: service.tokensCost,
        startsAt: now,
        endsAt,
        createdAt: now,
      })

      await tx.insert(walletTransactions).values({
        id: newId(),
        brandId: user.brandId,
        type: 'DEBIT_BOOST',
        amount: service.tokensCost,
        balanceAfter: newBalance,
        profileBoostId: boostId,
        description: `Boost: ${service.displayName}`,
        createdAt: now,
      })

      return { tokensBalance: newBalance, boost: { id: boostId, endsAt } }
    })
    return c.json(result)
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return c.json({ error: 'insufficient_tokens' }, 400)
    }
    throw err
  }
})
```

(`gt` is imported here in preparation for Task 8 — unused until then is fine since Task 8 lands in the same file right after.)

- [ ] **Step 4: Run tests** — `npx vitest run tests/routes/boost.test.ts` → PASS 5/5.

- [ ] **Step 5: Run full suite, rebuild, commit**

```bash
cd thrall && npm test
npm run build
git add thrall/src/routes/models.ts thrall/tests/routes/boost.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): POST /api/models/:id/boost spends wallet tokens"
```

---

## Task 8: `GET /api/models` — boosted models first

**Files:**
- Modify: `thrall/src/routes/models.ts`
- Modify: `thrall/tests/routes/models.test.ts`

- [ ] **Step 1: Add failing test**

Append to `thrall/tests/routes/models.test.ts`:

```ts
import { profileBoosts, topServices } from '../../src/db/schema'
import { db } from '../../src/db/client'
import { newId } from '../../src/lib/ulid'

describe('GET /api/models — boost ordering', () => {
  it('lists a boosted model before non-boosted ones and flags isBoosted', async () => {
    const brand = await createTestBrand()
    const plain = await createTestUser(brand, { role: 'model', email: `plain-${newId()}@test.com`, name: 'Plain' })
    const boosted = await createTestUser(brand, { role: 'model', email: `boosted-${newId()}@test.com`, name: 'Boosted' })
    const now = Date.now()
    await db.insert(profileBoosts).values({
      id: newId(), modelId: boosted.id, brandId: brand, purchasedBy: plain.id,
      topServiceId: 'svc_top_perfil_24h', tokensSpent: 50,
      startsAt: now, endsAt: now + 3_600_000, createdAt: now,
    })
    // Expired boost on `plain` must NOT count as active.
    await db.insert(profileBoosts).values({
      id: newId(), modelId: plain.id, brandId: brand, purchasedBy: plain.id,
      topServiceId: 'svc_top_perfil_24h', tokensSpent: 50,
      startsAt: now - 100_000, endsAt: now - 1000, createdAt: now - 100_000,
    })

    const res = await app.request('/api/models')
    const body = await res.json() as any[]
    const boostedEntry = body.find((m) => m.id === boosted.id)
    const plainEntry = body.find((m) => m.id === plain.id)
    expect(boostedEntry.isBoosted).toBe(true)
    expect(plainEntry.isBoosted).toBe(false)
    expect(body.indexOf(boostedEntry)).toBeLessThan(body.indexOf(plainEntry))
  })
})
```

Note: this test file currently mounts a bare `Hono().basePath('/api')` with only `modelsRoutes` — check the top of the file; if it imports `app` from `../../src/app` already for other describe blocks reuse that import, otherwise this new block needs `import app from '../../src/app'` since `db` + full app wiring is required. Use whichever `app` the file already has in scope; if the file only has the local minimal Hono instance, add `import app from '../../src/app'` and use `app.request(...)` for this new describe block specifically (the existing blocks can keep using the local minimal instance unchanged).

- [ ] **Step 2: Run to confirm fail** — `isBoosted` is `undefined`, ordering not guaranteed.

- [ ] **Step 3: Implement**

Replace the `GET /` handler in `thrall/src/routes/models.ts`:

```ts
modelsRoutes.get('/', async (c) => {
  const now = Date.now()
  const models = await db.query.users.findMany({
    where: (u, { and, eq, isNull }) =>
      and(eq(u.role, 'model'), eq(u.isActive, 1), isNull(u.deletedAt)),
  })

  const activeBoosts = await db
    .select({ modelId: profileBoosts.modelId })
    .from(profileBoosts)
    .where(gt(profileBoosts.endsAt, now))
  const boostedIds = new Set(activeBoosts.map((b) => b.modelId))

  const result = await Promise.all(
    models.map(async (m) => {
      const images = await db.query.userImages.findMany({
        where: (img, { and, eq, isNull }) =>
          and(eq(img.userId, m.id), eq(img.isActive, 1), isNull(img.deletedAt)),
        orderBy: (img, { asc }) => [asc(img.sortOrder)],
      })
      const { password: _, ...model } = m
      return {
        ...model,
        isBoosted: boostedIds.has(m.id),
        images: images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })),
      }
    })
  )

  result.sort((a, b) => Number(b.isBoosted) - Number(a.isBoosted))
  return c.json(result)
})
```

(`gt` was already imported in Task 7's import line.)

- [ ] **Step 4: Run tests**

`cd thrall && npx vitest run tests/routes/models.test.ts` → PASS (all cases, existing + new).

- [ ] **Step 5: Run full suite, rebuild, commit**

```bash
cd thrall && npm test
npm run build
git add thrall/src/routes/models.ts thrall/tests/routes/models.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): GET /api/models sorts boosted profiles first"
```

This closes out all thrall work — Tasks 1–8 are the entire backend surface for this spec.

---

## Task 9: Sylvanas — generalize `PlanCards` into a shared `ProductCards`

**Files:**
- Create: `sylvanas/components/shared/ProductCards.tsx` (generalized from `app/dashboard/subscribe/PlanCards.tsx`)
- Modify: `sylvanas/app/dashboard/subscribe/page.tsx` (use the shared component)
- Delete: `sylvanas/app/dashboard/subscribe/PlanCards.tsx`

**Interfaces produced:**
- `ProductCards({ products, purchaseAction, priceLabel? }: { products: Product[]; purchaseAction: (productId: string) => Promise<{ok:true,checkoutUrl:string}|{ok:false,error:string}>; priceLabel?: (p: Product) => string })` — client component, same UI as `PlanCards` but the checkout action and the price/duration line are injectable so `/dashboard/tokens` (Task 10) can reuse it with token-pack pricing text instead of "X días de acceso completo".

- [ ] **Step 1: Create the generalized component**

Create `sylvanas/components/shared/ProductCards.tsx`:

```tsx
"use client"
import { useState } from "react"

type Product = {
  id: string
  code: string
  displayName: string
  priceCop: number
}

function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
}

export function ProductCards<P extends Product>({
  products,
  purchaseAction,
  subtitle,
}: {
  products: P[]
  purchaseAction: (productId: string) => Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }>
  subtitle: (p: P) => string
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(productId: string) {
    setPending(productId); setError(null)
    const r = await purchaseAction(productId)
    if (r.ok) {
      window.location.href = r.checkoutUrl
    } else {
      setPending(null)
      setError("No se pudo iniciar el pago. Inténtalo de nuevo.")
    }
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {products.map(p => (
          <div key={p.id} className="rounded-lg border p-6 flex flex-col">
            <h3 className="text-lg font-semibold">{p.displayName}</h3>
            <p className="text-2xl font-bold mt-2">{formatCop(p.priceCop)}</p>
            <p className="text-sm text-neutral-500 mt-1">{subtitle(p)}</p>
            <button
              onClick={() => choose(p.id)}
              disabled={pending !== null}
              className="mt-6 rounded bg-black text-white px-4 py-2 disabled:opacity-50"
            >
              {pending === p.id ? "Redirigiendo…" : "Elegir plan"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Update the subscribe page to use it**

In `sylvanas/app/dashboard/subscribe/page.tsx`, replace:

```tsx
import { PlanCards } from "./PlanCards"
```
with:
```tsx
import { ProductCards } from "@/components/shared/ProductCards"
import { createCheckout } from "./actions"
```

And the type `Product` gains `durationDays` (unchanged from before). Replace `<PlanCards products={products} />` with:

```tsx
<ProductCards
  products={products}
  purchaseAction={createCheckout}
  subtitle={(p) => `${p.durationDays} días de acceso completo`}
/>
```

- [ ] **Step 3: Delete the old component**

```bash
rm sylvanas/app/dashboard/subscribe/PlanCards.tsx
```

- [ ] **Step 4: Build**

`cd sylvanas && npm run build` → succeeds, `/dashboard/subscribe` still compiles and behaves identically.

- [ ] **Step 5: Commit**

```bash
git add sylvanas/components/shared/ProductCards.tsx sylvanas/app/dashboard/subscribe/page.tsx
git rm sylvanas/app/dashboard/subscribe/PlanCards.tsx
git commit -m "refactor(sylvanas): generalize PlanCards into shared ProductCards"
```

---

## Task 10: Sylvanas — `/dashboard/tokens` page + wallet balance

**Files:**
- Create: `sylvanas/app/dashboard/tokens/page.tsx`
- Create: `sylvanas/app/dashboard/tokens/actions.ts`
- Create: `sylvanas/app/api/brand-wallet/route.ts`
- Modify: `sylvanas/lib/types.ts` is untouched here (wallet type is local to this feature, not shared)

- [ ] **Step 1: Route Handler proxy for the wallet**

Create `sylvanas/app/api/brand-wallet/route.ts`:

```ts
import { NextResponse } from "next/server"
import { apiFetch, ApiError } from "@/lib/api"

export async function GET() {
  try {
    const data = await apiFetch<{ tokensBalance: number; tokenDiscountPercent: number }>("/brand/wallet")
    return NextResponse.json(data)
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500
    return NextResponse.json({ tokensBalance: 0, tokenDiscountPercent: 0 }, { status })
  }
}
```

- [ ] **Step 2: Server action**

Create `sylvanas/app/dashboard/tokens/actions.ts`:

```ts
"use server"
import { apiFetch } from "@/lib/api"

export async function purchaseTokens(productId: string): Promise<
  { ok: true; checkoutUrl: string } | { ok: false; error: string }
> {
  try {
    const { checkoutUrl } = await apiFetch<{ checkoutUrl: string }>(
      "/brand/purchase-tokens",
      { method: "POST", body: JSON.stringify({ productId }) },
    )
    return { ok: true, checkoutUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, error: msg }
  }
}
```

- [ ] **Step 3: The page**

Create `sylvanas/app/dashboard/tokens/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api"
import { ProductCards } from "@/components/shared/ProductCards"
import { purchaseTokens } from "./actions"

type TokenProduct = {
  id: string
  code: string
  displayName: string
  priceCop: number
  tokensGranted: number
}

type Wallet = { tokensBalance: number; tokenDiscountPercent: number }

export default async function TokensPage() {
  const [products, wallet] = await Promise.all([
    apiFetch<TokenProduct[]>("/products?type=TOKEN_PACK").catch(() => [] as TokenProduct[]),
    apiFetch<Wallet>("/brand/wallet").catch(() => ({ tokensBalance: 0, tokenDiscountPercent: 0 })),
  ])

  return (
    <div className="mx-auto max-w-4xl py-8 space-y-8">
      <section className="rounded-lg border bg-neutral-50 p-6">
        <h2 className="text-lg font-semibold">Tu saldo</h2>
        <p className="text-3xl font-bold mt-1">{wallet.tokensBalance} tokens</p>
        {wallet.tokenDiscountPercent > 0 && (
          <p className="text-sm text-emerald-700 mt-2">
            Tienes {wallet.tokenDiscountPercent}% de descuento en compras de tokens por tu plan activo.
          </p>
        )}
      </section>
      <section>
        <h1 className="text-2xl font-semibold mb-4">Comprar tokens</h1>
        <ProductCards
          products={products}
          purchaseAction={purchaseTokens}
          subtitle={(p) => `${p.tokensGranted} tokens`}
        />
      </section>
    </div>
  )
}
```

Note: the price shown by `ProductCards` is the **list price** (`priceCop`), not the discounted one — the actual charge (computed server-side in Task 5) is discounted, but showing the discount applied per-card is a nice-to-have deferred to a follow-up (flagged already in the spec's "Open questions parked" — live refresh / richer wallet UI). For this task, the banner above the cards communicating "X% descuento" is enough so users aren't surprised when Wompi charges less than the listed price.

- [ ] **Step 4: Build**

`cd sylvanas && npm run build` → succeeds, `/dashboard/tokens` compiles.

- [ ] **Step 5: Commit**

```bash
git add sylvanas/app/dashboard/tokens sylvanas/app/api/brand-wallet
git commit -m "feat(sylvanas): /dashboard/tokens purchase page with wallet balance"
```

---

## Task 11: Sylvanas — "Destacar" button on model detail page

**Files:**
- Modify: `sylvanas/app/dashboard/models/actions.ts` (add `boostModel`)
- Create: `sylvanas/app/dashboard/models/[id]/boost-button.tsx`
- Modify: `sylvanas/app/dashboard/models/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/top-services` (new Route Handler proxy `app/api/top-services/route.ts`), `POST /models/:id/boost` via server action.

- [ ] **Step 1: Route Handler proxy for the boost catalog**

Create `sylvanas/app/api/top-services/route.ts`:

```ts
import { NextResponse } from "next/server"
import { apiFetch } from "@/lib/api"

export async function GET() {
  const data = await apiFetch<unknown[]>("/top-services")
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Server action**

In `sylvanas/app/dashboard/models/actions.ts`, add:

```ts
export async function boostModel(
  modelId: string,
  topServiceId: string
): Promise<{ error?: string; tokensBalance?: number; endsAt?: number }> {
  try {
    const res = await apiFetch<{ tokensBalance: number; boost: { endsAt: number } }>(
      `/models/${modelId}/boost`,
      { method: "POST", body: JSON.stringify({ topServiceId }) },
    )
    revalidatePath(`/dashboard/models/${modelId}`)
    return { tokensBalance: res.tokensBalance, endsAt: res.boost.endsAt }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo aplicar el boost" }
  }
}
```

(`apiFetch` and `revalidatePath` are already imported at the top of this file — confirm before adding a duplicate import.)

- [ ] **Step 3: The client component**

Create `sylvanas/app/dashboard/models/[id]/boost-button.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { boostModel } from "../actions"

type TopService = {
  id: string
  code: string
  displayName: string
  tokensCost: number
  durationHours: number
}

export function BoostButton({ modelId, services }: { modelId: string; services: TopService[] }) {
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState(services[0]?.id ?? "")

  if (services.length === 0) return null

  function onClick() {
    startTransition(async () => {
      const res = await boostModel(modelId, selected)
      if (res.error) toast.error(res.error)
      else toast.success("Modelo destacado")
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      >
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.displayName} — {s.tokensCost} tokens
          </option>
        ))}
      </select>
      <Button type="button" size="sm" onClick={onClick} disabled={isPending}>
        {isPending ? "…" : "Destacar"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Wire it into the model detail page**

In `sylvanas/app/dashboard/models/[id]/page.tsx`, add the import and fetch the catalog alongside the existing `Promise.all`-free sequential fetches (the file currently fetches `user` then `images` sequentially — add the top-services fetch the same way, tolerating failure):

```tsx
import { BoostButton } from "./boost-button"
```

Inside `ModelDetailPage`, after `const images = await getModelImages(id)`, add:

```tsx
  const topServices = await apiFetch<{ id: string; code: string; displayName: string; tokensCost: number; durationHours: number }[]>("/top-services").catch(() => [])
```

In the JSX, inside the `<section>` that renders `<h1>{user.name}</h1>` (or immediately after it), add:

```tsx
        <div className="mt-3">
          <BoostButton modelId={id} services={topServices} />
        </div>
```

- [ ] **Step 5: Build**

`cd sylvanas && npm run build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add sylvanas/app/dashboard/models sylvanas/app/api/top-services
git commit -m "feat(sylvanas): Destacar button spends wallet tokens on a model boost"
```

---

## Task 12: Illidan — "Destacado" badge

**Files:**
- Modify: `illidan/lib/types.ts` (add `isBoosted` to `Model`)
- Modify: `illidan/components/model-avatar.tsx` (or wherever the grid card renders — confirm exact component name during implementation; the illidan spec's file list names `components/model-avatar.tsx`)

- [ ] **Step 1: Extend the local `Model` type**

In `illidan/lib/types.ts`, add `isBoosted: boolean` to the `Model` interface (illidan duplicates this type per the spec's "Decisiones" table — do not import from sylvanas).

- [ ] **Step 2: Render the badge**

In the grid card component (`illidan/components/model-avatar.tsx` or the landing grid item — inspect the file during implementation since it wasn't read for this plan), add a small badge conditionally rendered when `model.isBoosted`, e.g. a gold "Destacada" pill positioned top-left of the card, consistent with the existing gold accent color (`var(--gold)`) used elsewhere in illidan's header.

This is purely cosmetic and low-risk — no backend contract changes (the field already exists on the `GET /api/models` response from Task 8).

- [ ] **Step 3: Build**

`cd illidan && npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add illidan/lib/types.ts illidan/components
git commit -m "feat(illidan): badge for boosted profiles"
```

---

## Task 13: Rollout

**Files:** none code — checklist to run end-to-end.

- [ ] **Step 1: Full suites**

```
cd thrall && npm test
cd sylvanas && npm test
cd illidan && npm run build   # illidan has no test suite per its spec; build is the smoke check
```

- [ ] **Step 2: Confirm token/boost pricing with the user**

Before applying migration 0005 to prod, confirm the placeholder prices in this plan's Global Constraints (`tokens_100/500/1500`, `top_perfil_24h`) — flagged as unconfirmed in the spec.

- [ ] **Step 3: Apply migration 0005 to prod Turso**

`cd thrall && npm run db:migrate` (prod credentials). Expected: `SELECT COUNT(*) FROM products WHERE type='TOKEN_PACK';` → 3, `SELECT COUNT(*) FROM top_services;` → 1.

- [ ] **Step 4: Deploy**

Push commits (user-driven, same as the Wompi plan's rollout). No new env vars — reuses the 6 Wompi/Sylvanas vars already configured.

- [ ] **Step 5: Sandbox smoke test**

1. Log in as an existing paid or trial brand.
2. Go to `/dashboard/tokens`, buy a token pack with the sandbox card.
3. Confirm wallet balance increases after the webhook fires (poll on the shared success page).
4. Go to a model's detail page, click "Destacar", confirm balance decreases and a toast confirms.
5. Open illidan's landing page, confirm the boosted model appears first with its badge.

---

## Self-Review Notes (author)

- **Spec coverage:** every numbered goal in the spec maps to a task — schema (T1), discount/expiry math (T2), catalog listing (T3), wallet read (T4), token purchase (T5), webhook credit (T6), boost spend (T7), boosted ordering (T8), sylvanas token page (T9–T10), boost UI (T11), illidan badge (T12), rollout (T13).
- **Reuse confirmed:** T5 and T9 explicitly reuse the Wompi plan's `buildCheckoutUrl`, success page, and `GET /api/brand/purchases/latest` without modification — verified those endpoints are generic over `productCode`/`status` and don't assume `SUBSCRIPTION`.
- **Race safety:** T6 and T7 both read the current wallet balance *inside* the `db.transaction()` callback (via `tx2.query.brandWallets`/`tx.query.brandWallets`), not before it — avoids a lost-update if two purchases/boosts land concurrently for the same brand.
- **Placeholder scan:** pricing values are explicitly flagged as unconfirmed (Global Constraints + Task 13 Step 2) rather than silently treated as final — this is a real open question, not a TODO left by accident.
- **Type consistency:** `WalletTransaction.type` spelled `'CREDIT_PURCHASE' | 'DEBIT_BOOST'` identically in schema, webhook, and boost route. `applyDiscount`/`computeBoostExpiry` signatures used identically between unit tests and route callers.
