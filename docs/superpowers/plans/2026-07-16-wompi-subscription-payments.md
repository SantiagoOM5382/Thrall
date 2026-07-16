# Wompi Subscription Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `POST /api/brand/subscribe` stub with a real Wompi Web Checkout flow that activates subscriptions on webhook approval.

**Architecture:** New `products` + `purchases` tables (polymorphic, ready for the future tokens spec). A pure `lib/wompi.ts` helper computes the checkout URL integrity signature and verifies webhook signatures. The `POST /api/brand/subscribe` route inserts a PENDING purchase and returns a signed Wompi checkout URL; the browser is redirected there. `POST /api/webhooks/wompi` verifies signature, updates purchase, and extends `brand_subscriptions.paidUntil` idempotently. Sylvanas gets three plan cards, a polling success page, and an "expires soon / expired" banner extension.

**Tech Stack:** Hono, Drizzle, libsql/Turso, Vitest (thrall). Next.js 15 App Router, Tailwind, Vitest (sylvanas). Wompi Web Checkout (`https://checkout.wompi.co/p/`).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-16-wompi-subscription-payments.md`.
- Products (exact codes and values): `sub_monthly` $85.000 COP / 30d, `sub_semester` $500.000 COP / 180d, `sub_annual` $980.000 COP / 365d.
- Renewal formula (used in webhook AND unit tests): `newPaidUntil = max(now, current.paidUntil ?? 0) + product.durationDays * 86400 * 1000`.
- Wompi amounts are in cents: `amountInCents = priceCop * 100`.
- Integrity signature: `sha256(reference + amountInCents + 'COP' + WOMPI_INTEGRITY_SECRET)` (hex).
- Webhook signature: for each key in `signature.properties`, resolve nested path in `data`; concat their string values in order + `timestamp` + `WOMPI_EVENTS_SECRET` → sha256 hex → compare to `signature.checksum`.
- Webhook returns 200 for anything not-signature-fail (Wompi retries on 4xx/5xx we don't want).
- Purchase status enum: `'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'` (mirrors Wompi statuses).
- All webhook writes wrapped in `db.transaction()`.
- After thrall src changes: `cd thrall && npm run build` + commit regenerated `dist/index.mjs`.
- Sylvanas: no Next/SWC bumps.
- Do NOT push to origin from tasks (final rollout is user-driven).
- Do NOT skip hooks.
- `dev` role bypasses `requirePaid` (unchanged from previous spec).

---

## Task 1: `products` + `purchases` schema and migration

**Files:**
- Modify: `thrall/src/db/schema.ts` (add two tables)
- Create: `thrall/migrations/0004_products_and_purchases.sql`
- Modify: `thrall/migrations/meta/_journal.json` (register 0004)

**Interfaces produced:**
- Drizzle `products` table with columns `{ id, code, type, displayName, priceCop, durationDays, tokensGranted, isActive, createdAt, updatedAt }`, unique index on `code`.
- Drizzle `purchases` table with columns `{ id, brandId, productId, userId, amountCop, status, wompiReference, wompiTransactionId, paidAt, createdAt, updatedAt }`, unique index on `wompiReference`, index on `(brandId, createdAt)`.
- Seeded product rows with codes `sub_monthly`, `sub_semester`, `sub_annual`.

- [ ] **Step 1: Add schema definitions**

Append to `thrall/src/db/schema.ts` (below existing tables):

```ts
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  type: text('type', { enum: ['SUBSCRIPTION', 'TOKEN_PACK'] }).notNull(),
  displayName: text('display_name').notNull(),
  priceCop: integer('price_cop').notNull(),
  durationDays: integer('duration_days'),
  tokensGranted: integer('tokens_granted'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  codeIdx: uniqueIndex('products_code_idx').on(t.code),
}))

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  productId: text('product_id').notNull().references(() => products.id),
  userId: text('user_id').notNull().references(() => users.id),
  amountCop: integer('amount_cop').notNull(),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] }).notNull(),
  wompiReference: text('wompi_reference').notNull(),
  wompiTransactionId: text('wompi_transaction_id'),
  paidAt: integer('paid_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  refIdx: uniqueIndex('purchases_wompi_reference_idx').on(t.wompiReference),
  brandCreatedIdx: index('purchases_brand_created_idx').on(t.brandId, t.createdAt),
}))
```

Import `index` from `drizzle-orm/sqlite-core` in the same import line as `uniqueIndex` if not present.

- [ ] **Step 2: Write migration SQL**

Create `thrall/migrations/0004_products_and_purchases.sql`:

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  price_cop INTEGER NOT NULL,
  duration_days INTEGER,
  tokens_granted INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX products_code_idx ON products(code);
--> statement-breakpoint
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_cop INTEGER NOT NULL,
  status TEXT NOT NULL,
  wompi_reference TEXT NOT NULL,
  wompi_transaction_id TEXT,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX purchases_wompi_reference_idx ON purchases(wompi_reference);
--> statement-breakpoint
CREATE INDEX purchases_brand_created_idx ON purchases(brand_id, created_at);
--> statement-breakpoint
INSERT INTO products (id, code, type, display_name, price_cop, duration_days, is_active, created_at, updated_at) VALUES
  ('prod_sub_monthly',  'sub_monthly',  'SUBSCRIPTION', 'Mensual',   85000,  30,  1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('prod_sub_semester', 'sub_semester', 'SUBSCRIPTION', 'Semestral', 500000, 180, 1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('prod_sub_annual',   'sub_annual',   'SUBSCRIPTION', 'Anual',     980000, 365, 1, strftime('%s','now')*1000, strftime('%s','now')*1000);
```

- [ ] **Step 3: Register the migration**

Open `thrall/migrations/meta/_journal.json`. Add a new entry after the last existing one (bump `idx`, set `when` to the current millis, `tag = "0004_products_and_purchases"`, `breakpoints = true`). Follow the exact shape used by 0002/0003.

- [ ] **Step 4: Apply migration locally**

Run: `cd thrall && npm run db:migrate`
Expected: journal shows 0004 applied; querying `SELECT COUNT(*) FROM products WHERE type='SUBSCRIPTION' AND is_active=1;` returns `3`.

- [ ] **Step 5: Run existing test suite**

Run: `cd thrall && npm test`
Expected: 90/90 passing (no regressions; no new tests yet).

- [ ] **Step 6: Rebuild bundle**

Run: `cd thrall && npm run build`

- [ ] **Step 7: Commit**

```bash
git add thrall/src/db/schema.ts thrall/migrations/0004_products_and_purchases.sql thrall/migrations/meta/_journal.json thrall/dist/index.mjs
git commit -m "feat(thrall): products + purchases tables with subscription seed"
```

---

## Task 2: `lib/wompi.ts` pure helpers with unit tests

**Files:**
- Create: `thrall/src/lib/wompi.ts`
- Create: `thrall/tests/lib/wompi.test.ts`

**Interfaces produced:**
- `buildCheckoutUrl(params: { publicKey: string; integritySecret: string; reference: string; amountInCents: number; currency: 'COP'; redirectUrl: string }): string`
- `computeIntegritySignature(reference: string, amountInCents: number, currency: string, secret: string): string`
- `verifyWebhookSignature(payload: { data: unknown; timestamp: number; signature: { properties: string[]; checksum: string } }, eventsSecret: string): boolean`
- `computeNewPaidUntil(current: { paidUntil: number | null }, product: { durationDays: number }, now?: number): number`

- [ ] **Step 1: Write failing unit tests**

Create `thrall/tests/lib/wompi.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  computeIntegritySignature,
  buildCheckoutUrl,
  verifyWebhookSignature,
  computeNewPaidUntil,
} from '../../src/lib/wompi'
import { createHash } from 'node:crypto'

describe('computeIntegritySignature', () => {
  it('matches sha256(reference + amountInCents + currency + secret) hex', () => {
    const sig = computeIntegritySignature('ref-123', 8500000, 'COP', 'my_secret')
    const expected = createHash('sha256').update('ref-1238500000COPmy_secret').digest('hex')
    expect(sig).toBe(expected)
  })
})

describe('buildCheckoutUrl', () => {
  it('includes all required query params and integrity signature', () => {
    const url = buildCheckoutUrl({
      publicKey: 'pub_test_XYZ',
      integritySecret: 'sec',
      reference: 'ref-1',
      amountInCents: 8500000,
      currency: 'COP',
      redirectUrl: 'https://sylvanas.example.com/dashboard/subscribe/success',
    })
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://checkout.wompi.co/p/')
    expect(u.searchParams.get('public-key')).toBe('pub_test_XYZ')
    expect(u.searchParams.get('currency')).toBe('COP')
    expect(u.searchParams.get('amount-in-cents')).toBe('8500000')
    expect(u.searchParams.get('reference')).toBe('ref-1')
    expect(u.searchParams.get('redirect-url')).toBe('https://sylvanas.example.com/dashboard/subscribe/success')
    expect(u.searchParams.get('signature:integrity')).toBe(
      computeIntegritySignature('ref-1', 8500000, 'COP', 'sec'),
    )
  })
})

describe('verifyWebhookSignature', () => {
  const secret = 'events_secret'
  const payload = {
    data: {
      transaction: { id: 'tx1', status: 'APPROVED', amount_in_cents: 8500000 },
    },
    timestamp: 1721000000,
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: '', // filled below
    },
  }
  // Concat values in order: 'tx1' + 'APPROVED' + '8500000' + '1721000000' + secret
  const good = createHash('sha256')
    .update('tx1APPROVED8500000' + '1721000000' + secret)
    .digest('hex')

  it('accepts a valid signature', () => {
    const p = { ...payload, signature: { ...payload.signature, checksum: good } }
    expect(verifyWebhookSignature(p, secret)).toBe(true)
  })

  it('rejects a tampered amount', () => {
    const tampered = {
      ...payload,
      data: { transaction: { ...payload.data.transaction, amount_in_cents: 1 } },
      signature: { ...payload.signature, checksum: good },
    }
    expect(verifyWebhookSignature(tampered, secret)).toBe(false)
  })

  it('rejects when a property path is missing', () => {
    const missing = {
      ...payload,
      data: { transaction: { id: 'tx1' } }, // no status/amount
      signature: { ...payload.signature, checksum: good },
    }
    expect(verifyWebhookSignature(missing, secret)).toBe(false)
  })
})

describe('computeNewPaidUntil', () => {
  const day = 86_400_000
  const now = 1_000_000_000_000

  it('extends by durationDays when current paidUntil is in the future', () => {
    const current = { paidUntil: now + 20 * day }
    const result = computeNewPaidUntil(current, { durationDays: 30 }, now)
    expect(result).toBe(now + 20 * day + 30 * day)
  })

  it('starts from now when current paidUntil is in the past', () => {
    const current = { paidUntil: now - 5 * day }
    const result = computeNewPaidUntil(current, { durationDays: 30 }, now)
    expect(result).toBe(now + 30 * day)
  })

  it('starts from now when current paidUntil is null', () => {
    const result = computeNewPaidUntil({ paidUntil: null }, { durationDays: 180 }, now)
    expect(result).toBe(now + 180 * day)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd thrall && npx vitest run tests/lib/wompi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `thrall/src/lib/wompi.ts`:

```ts
import { createHash } from 'node:crypto'

export function computeIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  secret: string,
): string {
  return createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest('hex')
}

export function buildCheckoutUrl(params: {
  publicKey: string
  integritySecret: string
  reference: string
  amountInCents: number
  currency: 'COP'
  redirectUrl: string
}): string {
  const sig = computeIntegritySignature(
    params.reference,
    params.amountInCents,
    params.currency,
    params.integritySecret,
  )
  const u = new URL('https://checkout.wompi.co/p/')
  u.searchParams.set('public-key', params.publicKey)
  u.searchParams.set('currency', params.currency)
  u.searchParams.set('amount-in-cents', String(params.amountInCents))
  u.searchParams.set('reference', params.reference)
  u.searchParams.set('redirect-url', params.redirectUrl)
  u.searchParams.set('signature:integrity', sig)
  return u.toString()
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export function verifyWebhookSignature(
  payload: {
    data: unknown
    timestamp: number
    signature: { properties: string[]; checksum: string }
  },
  eventsSecret: string,
): boolean {
  const parts: string[] = []
  for (const prop of payload.signature.properties) {
    const v = resolvePath(payload.data, prop)
    if (v === undefined || v === null) return false
    parts.push(String(v))
  }
  const raw = parts.join('') + String(payload.timestamp) + eventsSecret
  const computed = createHash('sha256').update(raw).digest('hex')
  return computed === payload.signature.checksum
}

export function computeNewPaidUntil(
  current: { paidUntil: number | null },
  product: { durationDays: number },
  now: number = Date.now(),
): number {
  const base = Math.max(now, current.paidUntil ?? 0)
  return base + product.durationDays * 86_400_000
}
```

- [ ] **Step 4: Run tests**

Run: `cd thrall && npx vitest run tests/lib/wompi.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/lib/wompi.ts thrall/tests/lib/wompi.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): wompi helpers (checkout URL, signature verify, paidUntil math)"
```

---

## Task 3: `GET /api/products` public listing

**Files:**
- Create: `thrall/src/routes/products.ts`
- Modify: `thrall/src/app.ts` (mount route)
- Create: `thrall/tests/routes/products.test.ts`

**Interfaces produced:**
- `GET /api/products?type=SUBSCRIPTION` returns an array of active products with fields `{ id, code, type, displayName, priceCop, durationDays, tokensGranted }`. Default type filter when the param is missing is `SUBSCRIPTION`.

- [ ] **Step 1: Write failing test**

Create `thrall/tests/routes/products.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'

describe('GET /api/products', () => {
  it('lists active SUBSCRIPTION products by default', async () => {
    const res = await app.request('/api/products')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    const codes = body.map((p: { code: string }) => p.code).sort()
    expect(codes).toEqual(['sub_annual', 'sub_monthly', 'sub_semester'])
    for (const p of body) {
      expect(p.type).toBe('SUBSCRIPTION')
      expect(p.priceCop).toBeGreaterThan(0)
      expect(typeof p.displayName).toBe('string')
      expect(typeof p.durationDays).toBe('number')
    }
  })

  it('respects ?type filter', async () => {
    const res = await app.request('/api/products?type=TOKEN_PACK')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})
```

- [ ] **Step 2: Run to confirm fail**

Run: `cd thrall && npx vitest run tests/routes/products.test.ts`
Expected: FAIL (404 route not mounted).

- [ ] **Step 3: Implement**

Create `thrall/src/routes/products.ts`:

```ts
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { products } from '../db/schema'

export const productsRoutes = new Hono()

productsRoutes.get('/', async (c) => {
  const type = (c.req.query('type') ?? 'SUBSCRIPTION') as 'SUBSCRIPTION' | 'TOKEN_PACK'
  const rows = await db
    .select({
      id: products.id,
      code: products.code,
      type: products.type,
      displayName: products.displayName,
      priceCop: products.priceCop,
      durationDays: products.durationDays,
      tokensGranted: products.tokensGranted,
    })
    .from(products)
    .where(and(eq(products.type, type), eq(products.isActive, 1)))
  return c.json(rows)
})
```

Mount in `thrall/src/app.ts` (add import + mount before `/health`):

```ts
import { productsRoutes } from './routes/products'
// ...
app.route('/products', productsRoutes)
```

- [ ] **Step 4: Run tests**

Run: `cd thrall && npx vitest run tests/routes/products.test.ts`
Expected: PASS 2/2.

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/routes/products.ts thrall/src/app.ts thrall/tests/routes/products.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): GET /api/products public listing"
```

---

## Task 4: `POST /api/brand/subscribe` real implementation

**Files:**
- Modify: `thrall/src/routes/brand.ts` (replace stub)
- Create: `thrall/tests/routes/subscribe.test.ts`

**Interfaces:**
- Consumes: `buildCheckoutUrl` from `src/lib/wompi.ts`; `products`, `purchases` tables.
- Produces: `POST /api/brand/subscribe { productId: string }` returns `200 { checkoutUrl }`. Inserts a PENDING `purchases` row.

- [ ] **Step 1: Write failing tests**

Create `thrall/tests/routes/subscribe.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '../../src/db/client'
import { purchases } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

process.env.WOMPI_PUBLIC_KEY ??= 'pub_test_xxx'
process.env.WOMPI_INTEGRITY_SECRET ??= 'integrity_secret_test'
process.env.SYLVANAS_URL ??= 'https://sylvanas.example.com'

async function post(token: string, body: object) {
  return app.request('/api/brand/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/brand/subscribe', () => {
  it('returns a Wompi checkout URL and inserts a PENDING purchase', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await post(token, { productId: 'prod_sub_monthly' })
    expect(res.status).toBe(200)
    const { checkoutUrl } = await res.json()
    const url = new URL(checkoutUrl)
    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/')
    expect(url.searchParams.get('amount-in-cents')).toBe('8500000')
    const ref = url.searchParams.get('reference')!
    expect(ref.length).toBeGreaterThan(0)
    expect(url.searchParams.get('signature:integrity')?.length).toBe(64)
    expect(url.searchParams.get('redirect-url'))
      .toBe('https://sylvanas.example.com/dashboard/subscribe/success')

    const rows = await db.select().from(purchases).where(eq(purchases.wompiReference, ref))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('PENDING')
    expect(rows[0].amountCop).toBe(85000)
    expect(rows[0].brandId).toBe(brand)
    expect(rows[0].userId).toBe(u.id)
    expect(rows[0].productId).toBe('prod_sub_monthly')
  })

  it('rejects unknown productId with 400', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await post(token, { productId: 'does_not_exist' })
    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.request('/api/brand/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'prod_sub_monthly' }),
    })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

Run: `cd thrall && npx vitest run tests/routes/subscribe.test.ts`
Expected: 3 fail (current stub returns 501).

- [ ] **Step 3: Replace the stub**

Edit `thrall/src/routes/brand.ts`. Add imports and replace the existing `brandRoutes.post('/subscribe', ...)` handler with:

```ts
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { products, purchases } from '../db/schema'
import { newId } from '../lib/ulid'
import { buildCheckoutUrl } from '../lib/wompi'

const subscribeSchema = z.object({ productId: z.string().min(1) })

brandRoutes.post('/subscribe', zValidator('json', subscribeSchema), async (c) => {
  const user = c.get('user')
  const { productId } = c.req.valid('json')

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.isActive, 1)),
  })
  if (!product || product.type !== 'SUBSCRIPTION' || product.durationDays == null) {
    return c.json({ error: 'invalid_product' }, 400)
  }

  const pub = process.env.WOMPI_PUBLIC_KEY
  const integrity = process.env.WOMPI_INTEGRITY_SECRET
  const sylvanas = process.env.SYLVANAS_URL
  if (!pub || !integrity || !sylvanas) {
    return c.json({ error: 'wompi_not_configured' }, 500)
  }

  const reference = newId()
  const now = Date.now()
  await db.insert(purchases).values({
    id: newId(),
    brandId: user.brandId,
    productId: product.id,
    userId: user.sub,
    amountCop: product.priceCop,
    status: 'PENDING',
    wompiReference: reference,
    createdAt: now,
    updatedAt: now,
  })

  const checkoutUrl = buildCheckoutUrl({
    publicKey: pub,
    integritySecret: integrity,
    reference,
    amountInCents: product.priceCop * 100,
    currency: 'COP',
    redirectUrl: `${sylvanas}/dashboard/subscribe/success`,
  })

  return c.json({ checkoutUrl })
})
```

- [ ] **Step 4: Run tests**

Run: `cd thrall && npx vitest run tests/routes/subscribe.test.ts`
Expected: PASS 3/3.

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/routes/brand.ts thrall/tests/routes/subscribe.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): POST /api/brand/subscribe returns Wompi checkout URL"
```

---

## Task 5: `GET /api/brand/purchases/latest`

**Files:**
- Modify: `thrall/src/routes/brand.ts` (add endpoint)
- Create: `thrall/tests/routes/purchases-latest.test.ts`

**Interfaces produced:**
- `GET /api/brand/purchases/latest` returns `{ latest: null }` or `{ latest: { id, productCode, amountCop, status, wompiReference, paidAt, createdAt } }`.

- [ ] **Step 1: Failing tests**

Create `thrall/tests/routes/purchases-latest.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { db } from '../../src/db/client'
import { purchases } from '../../src/db/schema'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'
import { newId } from '../../src/lib/ulid'

async function get(token: string) {
  return app.request('/api/brand/purchases/latest', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

describe('GET /api/brand/purchases/latest', () => {
  it('returns null when brand has no purchases', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const res = await get(token)
    const body = await res.json()
    expect(body).toEqual({ latest: null })
  })

  it('returns the newest purchase for the brand', async () => {
    const brand = await createTestBrand()
    const u = await createTestUser(brand, { role: 'admin' })
    const token = await tokenFor(u.id, 'admin', brand)
    const now = Date.now()
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_sub_monthly', userId: u.id,
      amountCop: 85000, status: 'PENDING', wompiReference: 'ref-old',
      createdAt: now - 5000, updatedAt: now - 5000,
    })
    await db.insert(purchases).values({
      id: newId(), brandId: brand, productId: 'prod_sub_monthly', userId: u.id,
      amountCop: 85000, status: 'APPROVED', wompiReference: 'ref-new',
      paidAt: now, createdAt: now, updatedAt: now,
    })
    const res = await get(token)
    const body = await res.json()
    expect(body.latest.wompiReference).toBe('ref-new')
    expect(body.latest.status).toBe('APPROVED')
    expect(body.latest.productCode).toBe('sub_monthly')
    expect(body.latest.amountCop).toBe(85000)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

Run: `cd thrall && npx vitest run tests/routes/purchases-latest.test.ts`
Expected: FAIL (route not mounted).

- [ ] **Step 3: Implement**

Add to `thrall/src/routes/brand.ts` after the existing handlers:

```ts
import { desc } from 'drizzle-orm'

brandRoutes.get('/purchases/latest', async (c) => {
  const user = c.get('user')
  const row = await db
    .select({
      id: purchases.id,
      productCode: products.code,
      amountCop: purchases.amountCop,
      status: purchases.status,
      wompiReference: purchases.wompiReference,
      paidAt: purchases.paidAt,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(products, eq(products.id, purchases.productId))
    .where(eq(purchases.brandId, user.brandId))
    .orderBy(desc(purchases.createdAt))
    .limit(1)
  return c.json({ latest: row[0] ?? null })
})
```

(If `products` / `eq` / `desc` aren't already imported at the top, add them.)

- [ ] **Step 4: Run**

Run: `cd thrall && npx vitest run tests/routes/purchases-latest.test.ts`
Expected: PASS 2/2.

- [ ] **Step 5: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/routes/brand.ts thrall/tests/routes/purchases-latest.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): GET /api/brand/purchases/latest"
```

---

## Task 6: `POST /api/webhooks/wompi` with signature verify, idempotency, transaction

**Files:**
- Create: `thrall/src/routes/webhooks.ts`
- Modify: `thrall/src/app.ts` (mount `/webhooks`)
- Create: `thrall/tests/routes/webhook-wompi.test.ts`

**Interfaces:**
- Consumes: `verifyWebhookSignature`, `computeNewPaidUntil` from `src/lib/wompi.ts`; `purchases`, `products`, `brandSubscriptions`.
- Produces: `POST /api/webhooks/wompi` — public (no auth middleware). Returns 401 on bad signature; 200 on everything else.

- [ ] **Step 1: Failing tests**

Create `thrall/tests/routes/webhook-wompi.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import { db } from '../../src/db/client'
import { purchases, brandSubscriptions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import app from '../../src/app'
import { createTestBrand, createTestUser } from '../helpers'
import { newId } from '../../src/lib/ulid'

process.env.WOMPI_EVENTS_SECRET ??= 'events_secret_test'
const EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET!

function buildPayload(opts: {
  reference: string
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'
  amountInCents?: number
  transactionId?: string
}) {
  const txId = opts.transactionId ?? 'tx-' + newId()
  const amount = opts.amountInCents ?? 8500000
  const timestamp = Math.floor(Date.now() / 1000)
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
  const data = { transaction: { id: txId, reference: opts.reference, status: opts.status, amount_in_cents: amount } }
  const raw = `${txId}${opts.status}${amount}${timestamp}${EVENTS_SECRET}`
  const checksum = createHash('sha256').update(raw).digest('hex')
  return {
    event: 'transaction.updated',
    data,
    sent_at: new Date().toISOString(),
    timestamp,
    signature: { properties, checksum },
    environment: 'test',
  }
}

async function post(body: object) {
  return app.request('/api/webhooks/wompi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function seedPending(brandId: string, userId: string, ref: string, productId = 'prod_sub_monthly') {
  const now = Date.now()
  await db.insert(purchases).values({
    id: newId(), brandId, productId, userId, amountCop: 85000,
    status: 'PENDING', wompiReference: ref,
    createdAt: now, updatedAt: now,
  })
}

describe('POST /api/webhooks/wompi', () => {
  it('rejects invalid signature with 401', async () => {
    const body = buildPayload({ reference: 'ref-x', status: 'APPROVED' })
    body.signature.checksum = 'deadbeef'
    const res = await post(body)
    expect(res.status).toBe(401)
  })

  it('returns 200 for unknown reference', async () => {
    const body = buildPayload({ reference: 'ref-unknown', status: 'APPROVED' })
    const res = await post(body)
    expect(res.status).toBe(200)
  })

  it('activates paid subscription on APPROVED for a FREE-expired brand', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-a-' + newId()
    await seedPending(brand, u.id, ref)
    const body = buildPayload({ reference: ref, status: 'APPROVED' })
    const res = await post(body)
    expect(res.status).toBe(200)

    const p = await db.query.purchases.findFirst({ where: eq(purchases.wompiReference, ref) })
    expect(p?.status).toBe('APPROVED')
    expect(p?.paidAt).toBeGreaterThan(0)

    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub?.tier).toBe('paid')
    expect(sub?.status).toBe('active')
    expect(sub?.paidUntil).toBeGreaterThan(Date.now() + 29 * 86_400_000)
    expect(sub?.paidUntil).toBeLessThan(Date.now() + 31 * 86_400_000)
    expect(sub?.trialEndsAt).toBeNull()
  })

  it('is idempotent — duplicate APPROVED does not double-extend paidUntil', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-idem-' + newId()
    await seedPending(brand, u.id, ref)
    const body1 = buildPayload({ reference: ref, status: 'APPROVED' })
    await post(body1)
    const sub1 = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    const paidUntil1 = sub1!.paidUntil!

    const body2 = buildPayload({ reference: ref, status: 'APPROVED' })
    await post(body2)
    const sub2 = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub2!.paidUntil).toBe(paidUntil1)
  })

  it('extends existing paidUntil when brand is already paid-active', async () => {
    const day = 86_400_000
    const now = Date.now()
    const brand = await createTestBrand({
      tier: 'paid', status: 'active', isGrandfathered: 0, paidUntil: now + 20 * day,
    })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-ext-' + newId()
    await seedPending(brand, u.id, ref)
    const body = buildPayload({ reference: ref, status: 'APPROVED' })
    await post(body)
    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub!.paidUntil).toBeGreaterThan(now + 49 * day)
    expect(sub!.paidUntil).toBeLessThan(now + 51 * day)
  })

  it('DECLINED updates purchase but not brand_subscriptions', async () => {
    const brand = await createTestBrand({ tier: 'free', status: 'expired', isGrandfathered: 0 })
    const u = await createTestUser(brand, { role: 'admin' })
    const ref = 'ref-dec-' + newId()
    await seedPending(brand, u.id, ref)
    const body = buildPayload({ reference: ref, status: 'DECLINED' })
    await post(body)
    const p = await db.query.purchases.findFirst({ where: eq(purchases.wompiReference, ref) })
    expect(p?.status).toBe('DECLINED')
    const sub = await db.query.brandSubscriptions.findFirst({ where: eq(brandSubscriptions.brandId, brand) })
    expect(sub?.tier).toBe('free')
    expect(sub?.paidUntil).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm failures**

Run: `cd thrall && npx vitest run tests/routes/webhook-wompi.test.ts`
Expected: all fail (route not mounted).

- [ ] **Step 3: Implement the handler**

Create `thrall/src/routes/webhooks.ts`:

```ts
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { purchases, products, brandSubscriptions } from '../db/schema'
import { verifyWebhookSignature, computeNewPaidUntil } from '../lib/wompi'

export const webhooksRoutes = new Hono()

type WompiStatus = 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'
const TERMINAL: ReadonlySet<string> = new Set(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'])

webhooksRoutes.post('/wompi', async (c) => {
  const secret = process.env.WOMPI_EVENTS_SECRET
  if (!secret) return c.json({ error: 'wompi_not_configured' }, 500)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'bad_json' }, 400)
  }

  if (!verifyWebhookSignature(body, secret)) {
    return c.json({ error: 'invalid_signature' }, 401)
  }

  if (body.event !== 'transaction.updated') {
    return c.json({ ok: true, ignored: 'unhandled_event' })
  }

  const tx = body?.data?.transaction
  if (!tx?.reference || !tx?.status) {
    return c.json({ ok: true, ignored: 'malformed_payload' })
  }

  const purchase = await db.query.purchases.findFirst({
    where: eq(purchases.wompiReference, tx.reference),
  })
  if (!purchase) {
    return c.json({ ok: true, ignored: 'unknown_reference' })
  }

  if (TERMINAL.has(purchase.status)) {
    return c.json({ ok: true, ignored: 'already_processed' })
  }

  const status = tx.status as WompiStatus
  if (status === 'PENDING') {
    return c.json({ ok: true, ignored: 'still_pending' })
  }

  await db.transaction(async (tx2) => {
    const now = Date.now()
    await tx2.update(purchases)
      .set({
        status,
        wompiTransactionId: tx.id,
        paidAt: status === 'APPROVED' ? now : null,
        updatedAt: now,
      })
      .where(eq(purchases.id, purchase.id))

    if (status === 'APPROVED') {
      const product = await tx2.query.products.findFirst({
        where: eq(products.id, purchase.productId),
      })
      if (!product || product.durationDays == null) return
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
    }
  })

  return c.json({ ok: true })
})
```

Mount in `thrall/src/app.ts`:

```ts
import { webhooksRoutes } from './routes/webhooks'
// ...
app.route('/webhooks', webhooksRoutes)
```

- [ ] **Step 4: Run tests**

Run: `cd thrall && npx vitest run tests/routes/webhook-wompi.test.ts`
Expected: PASS 6/6.

- [ ] **Step 5: Run full suite**

Run: `cd thrall && npm test`
Expected: all previous suites still green.

- [ ] **Step 6: Rebuild + commit**

```bash
cd thrall && npm run build
git add thrall/src/routes/webhooks.ts thrall/src/app.ts thrall/tests/routes/webhook-wompi.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): Wompi webhook with signature verify + idempotent activation"
```

---

## Task 7: Sylvanas `/dashboard/subscribe` page rewrite with 3 plan cards

**Files:**
- Modify: `sylvanas/app/dashboard/subscribe/page.tsx`
- Create: `sylvanas/app/dashboard/subscribe/actions.ts`
- Create: `sylvanas/app/dashboard/subscribe/PlanCards.tsx` (client, calls server action)

**Interfaces:**
- Consumes: `getSubscription()` from `@/lib/subscription-server`; new thrall endpoints `/products?type=SUBSCRIPTION` and `/brand/subscribe`.
- Produces: page renders 3 plan cards + click triggers checkout URL → `window.location.href`.

- [ ] **Step 1: Create the server action**

Create `sylvanas/app/dashboard/subscribe/actions.ts`:

```ts
"use server"
import { apiFetch } from "@/lib/api"

export async function createCheckout(productId: string): Promise<
  { ok: true; checkoutUrl: string } | { ok: false; error: string }
> {
  try {
    const { checkoutUrl } = await apiFetch<{ checkoutUrl: string }>(
      "/brand/subscribe",
      { method: "POST", body: JSON.stringify({ productId }) },
    )
    return { ok: true, checkoutUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, error: msg }
  }
}
```

- [ ] **Step 2: Create the plan cards client component**

Create `sylvanas/app/dashboard/subscribe/PlanCards.tsx`:

```tsx
"use client"
import { useState } from "react"
import { createCheckout } from "./actions"

type Product = {
  id: string
  code: string
  displayName: string
  priceCop: number
  durationDays: number
}

function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
}

export function PlanCards({ products }: { products: Product[] }) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(productId: string) {
    setPending(productId); setError(null)
    const r = await createCheckout(productId)
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
            <p className="text-sm text-neutral-500 mt-1">{p.durationDays} días de acceso completo</p>
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

- [ ] **Step 3: Rewrite the page**

Replace `sylvanas/app/dashboard/subscribe/page.tsx` with:

```tsx
import { redirect } from "next/navigation"
import { getSubscription } from "@/lib/subscription-server"
import { apiFetch } from "@/lib/api"
import { UpsellCard } from "@/components/shared/UpsellCard"
import { PlanCards } from "./PlanCards"

type Product = {
  id: string
  code: string
  displayName: string
  priceCop: number
  durationDays: number
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })
}

export default async function SubscribePage() {
  const [sub, products] = await Promise.all([
    getSubscription(),
    apiFetch<Product[]>("/products?type=SUBSCRIPTION").catch(() => [] as Product[]),
  ])

  if (sub.isGrandfathered) {
    return (
      <div className="mx-auto max-w-2xl mt-16 rounded-lg border p-8 text-center">
        <h2 className="text-xl font-semibold">Cuenta especial</h2>
        <p className="text-neutral-600 mt-2">Tu cuenta no requiere suscripción.</p>
      </div>
    )
  }

  const isPaid = sub.isPaidEffective && sub.tier === "paid"

  return (
    <div className="mx-auto max-w-4xl py-8 space-y-8">
      {isPaid && sub.paidUntil && (
        <section className="rounded-lg border bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold">Suscripción activa</h2>
          <p className="text-neutral-700 mt-1">Tu plan vence el <b>{formatDate(sub.paidUntil)}</b>.</p>
          <p className="text-sm text-neutral-500 mt-2">Puedes renovar o cambiar de plan; los días se acumulan.</p>
        </section>
      )}
      <section>
        <h1 className="text-2xl font-semibold mb-4">
          {isPaid ? "Renovar o cambiar plan" : "Elige tu plan"}
        </h1>
        <PlanCards products={products} />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Build**

Run: `cd sylvanas && npm run build`
Expected: succeeds, `/dashboard/subscribe` compiles.

- [ ] **Step 5: Commit**

```bash
git add sylvanas/app/dashboard/subscribe
git commit -m "feat(sylvanas): 3-plan subscribe page with Wompi checkout kickoff"
```

---

## Task 8: `/dashboard/subscribe/success` polling page + Route Handler

**Files:**
- Create: `sylvanas/app/dashboard/subscribe/success/page.tsx`
- Create: `sylvanas/app/api/brand-purchases-latest/route.ts`

**Interfaces:**
- Consumes: thrall `GET /brand/purchases/latest`.

- [ ] **Step 1: Create the Route Handler proxy**

Create `sylvanas/app/api/brand-purchases-latest/route.ts`:

```ts
import { NextResponse } from "next/server"
import { apiFetch, ApiError } from "@/lib/api"

export async function GET() {
  try {
    const data = await apiFetch<{ latest: unknown }>("/brand/purchases/latest")
    return NextResponse.json(data)
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500
    return NextResponse.json({ latest: null }, { status })
  }
}
```

- [ ] **Step 2: Create the success page**

Create `sylvanas/app/dashboard/subscribe/success/page.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

type Latest = null | {
  id: string
  productCode: string
  amountCop: number
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
  wompiReference: string
  paidAt: number | null
  createdAt: number
}

type UiState = 'polling' | 'approved' | 'declined' | 'timeout'

export default function SuccessPage() {
  const [state, setState] = useState<UiState>('polling')

  useEffect(() => {
    let cancelled = false
    const started = Date.now()
    const TIMEOUT_MS = 30_000
    const INTERVAL_MS = 2_000

    async function tick() {
      if (cancelled) return
      try {
        const res = await fetch('/api/brand-purchases-latest', { cache: 'no-store' })
        const body = await res.json() as { latest: Latest }
        const s = body.latest?.status
        if (s === 'APPROVED') { setState('approved'); return }
        if (s === 'DECLINED' || s === 'VOIDED' || s === 'ERROR') { setState('declined'); return }
      } catch { /* keep polling */ }
      if (Date.now() - started > TIMEOUT_MS) { setState('timeout'); return }
      setTimeout(tick, INTERVAL_MS)
    }
    tick()
    return () => { cancelled = true }
  }, [])

  const card = 'mx-auto max-w-md mt-16 rounded-lg border p-8 text-center'

  if (state === 'polling') return (
    <div className={card}>
      <p className="text-neutral-600">Estamos confirmando tu pago con Wompi…</p>
      <div className="mt-4 h-1 w-full bg-neutral-200 overflow-hidden rounded"><div className="h-full w-1/3 bg-neutral-500 animate-pulse" /></div>
    </div>
  )
  if (state === 'approved') return (
    <div className={`${card} border-emerald-300 bg-emerald-50`}>
      <h2 className="text-xl font-semibold">¡Suscripción activa!</h2>
      <p className="text-neutral-700 mt-2">Tu plan ya está desbloqueado.</p>
      <Link href="/dashboard" className="mt-4 inline-block rounded bg-black text-white px-4 py-2">Ir al dashboard</Link>
    </div>
  )
  if (state === 'declined') return (
    <div className={`${card} border-red-300 bg-red-50`}>
      <h2 className="text-xl font-semibold">El pago no se completó</h2>
      <Link href="/dashboard/subscribe" className="mt-4 inline-block rounded bg-black text-white px-4 py-2">Intentar de nuevo</Link>
    </div>
  )
  return (
    <div className={`${card} border-amber-300 bg-amber-50`}>
      <h2 className="text-xl font-semibold">Wompi sigue procesando</h2>
      <p className="text-neutral-700 mt-2">Te avisaremos cuando confirme. Puedes volver al dashboard.</p>
      <Link href="/dashboard" className="mt-4 inline-block rounded bg-black text-white px-4 py-2">Ir al dashboard</Link>
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `cd sylvanas && npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add sylvanas/app/dashboard/subscribe/success sylvanas/app/api/brand-purchases-latest
git commit -m "feat(sylvanas): subscribe success page with polling + latest-purchase proxy"
```

---

## Task 9: Extend `TrialBanner` with paid-expiring/expired branches

**Files:**
- Modify: `sylvanas/components/shared/TrialBanner.tsx`

- [ ] **Step 1: Update the banner**

Open `sylvanas/components/shared/TrialBanner.tsx`. Add two branches after the existing trial-expired branch, still respecting the grandfathered short-circuit at the top:

```tsx
// existing trial banners...

// NEW: paid, expiring soon (≤5 days)
if (s.tier === 'paid' && s.status === 'active' && s.daysLeft !== null && s.daysLeft > 0 && s.daysLeft <= 5) {
  return (
    <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm flex items-center justify-between">
      <span>Tu plan vence en {s.daysLeft} día{s.daysLeft === 1 ? '' : 's'}.</span>
      <a href="/dashboard/subscribe" className="underline font-medium">Renovar</a>
    </div>
  )
}

// NEW: paid, already expired
if (s.tier === 'paid' && !s.isPaidEffective) {
  return (
    <div className="bg-red-100 text-red-900 px-4 py-2 text-sm flex items-center justify-between">
      <span>Tu plan venció. Muchas funciones están bloqueadas.</span>
      <a href="/dashboard/subscribe" className="underline font-medium">Renovar</a>
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd sylvanas && npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add sylvanas/components/shared/TrialBanner.tsx
git commit -m "feat(sylvanas): banner for paid-expiring and paid-expired states"
```

---

## Task 10: Rollout — env vars, Wompi merchant config, manual sandbox smoke

**Files:** none code — this is a rollout checklist to run end-to-end.

- [ ] **Step 1: Full thrall + sylvanas test suites**

Run:
```
cd thrall && npm test
cd sylvanas && npm test
```
Expected: all green.

- [ ] **Step 2: Apply migration 0004 to prod Turso**

Run: `cd thrall && npm run db:migrate` (with prod `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` in env).
Expected: migration applied; `SELECT COUNT(*) FROM products` returns 3.

- [ ] **Step 3: Configure Vercel env vars (thrall project)**

In Vercel dashboard for thrall, add:
- `WOMPI_PUBLIC_KEY` = `pub_test_...` (sandbox for now)
- `WOMPI_PRIVATE_KEY` = `prv_test_...`
- `WOMPI_INTEGRITY_SECRET` = `test_integrity_...`
- `WOMPI_EVENTS_SECRET` = `test_events_...`
- `WOMPI_ENV` = `test`
- `SYLVANAS_URL` = `https://<sylvanas-vercel-domain>`

- [ ] **Step 4: Configure Wompi merchant dashboard**

Log in at https://comercios.wompi.co (sandbox mode). Set:
- **URL de Eventos:** `https://thrall-delta.vercel.app/api/webhooks/wompi`

- [ ] **Step 5: Deploy**

Push commits. Vercel redeploys thrall + sylvanas automatically.

- [ ] **Step 6: Sandbox smoke — full round-trip**

1. Sign up a fresh test brand at `https://<sylvanas>/signup`.
2. Force `trialEndsAt` to a past timestamp in Turso, reload dashboard → red trial-expired banner appears.
3. Click "Renovar" → `/dashboard/subscribe` shows 3 plan cards.
4. Choose "Mensual" → redirects to Wompi hosted checkout.
5. Pay with sandbox card `4242 4242 4242 4242`, cvc `123`, any future date.
6. Wompi redirects to `/dashboard/subscribe/success` → polling UI → "¡Suscripción activa!".
7. Return to dashboard → banner is gone, gated routes work.
8. Verify in Turso: `purchases` row APPROVED with `wompi_transaction_id` set, `brand_subscriptions.paidUntil` ≈ now + 30d.

- [ ] **Step 7: Clean up test data**

Delete the test brand + its user + purchase (as in the multi-tenancy plan's Task 12).

- [ ] **Step 8: Prod flip (later, when Wompi approves merchant for production)**

Swap the 5 Wompi env vars in Vercel to `prod` values, set `WOMPI_ENV=prod`, update the Wompi merchant dashboard URL de Eventos, and redeploy.

---

## Self-Review Notes (author)

- **Spec coverage:**
  - Products/purchases schema ✓ (T1)
  - Wompi lib (checkout URL, signature verify, paidUntil math) ✓ (T2)
  - `GET /products` ✓ (T3)
  - `POST /brand/subscribe` ✓ (T4)
  - `GET /brand/purchases/latest` ✓ (T5)
  - `POST /webhooks/wompi` with idempotency + transaction ✓ (T6)
  - `/dashboard/subscribe` with 3 cards + current-plan panel ✓ (T7)
  - `/dashboard/subscribe/success` polling + proxy ✓ (T8)
  - `TrialBanner` extension ✓ (T9)
  - Env vars + Wompi config + smoke ✓ (T10)
- **Placeholder scan:** no TBD / TODO / "handle appropriately" — all steps have code or exact commands.
- **Type consistency:** `SubscriptionState` shape unchanged (reused from earlier plan). Purchase status enum is spelled `'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'` everywhere (schema, tests, webhook mapping, success page union). `computeNewPaidUntil` signature `(current: { paidUntil: number | null }, product: { durationDays: number }, now?)` used identically in unit test and webhook handler. `computeIntegritySignature`, `buildCheckoutUrl`, `verifyWebhookSignature` signatures consistent between test and route caller.
- **Grandfathered brands:** subscribe page short-circuits; webhook and lib helpers are agnostic (grandfathered brands wouldn't normally hit checkout, but if they did, the paidUntil math still works — the "grandfathered" branch is separate in `computeEffectiveAccess`).
