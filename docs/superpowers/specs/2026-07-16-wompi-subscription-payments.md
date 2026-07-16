# Wompi subscription payments

Date: 2026-07-16
Status: Draft — pending user review

## Context

The multi-tenancy spec (2026-07-15) shipped FREE/PAID tiers with a 10-day trial and a stub `POST /api/brand/subscribe` that returns `501 not_implemented`. This spec replaces the stub with a real Wompi Web Checkout flow so brands can convert trial → paid. Payments are one-shot (mensual/semestral/anual); auto-debit is deferred to a separate spec.

## Goals

1. Catalog three subscription products (`sub_monthly` $85.000 / 30d, `sub_semester` $500.000 / 180d, `sub_annual` $980.000 / 365d) in a new `products` table.
2. Persist all payment attempts in a new `purchases` table with a Wompi transaction reference.
3. `POST /api/brand/subscribe { productId }` returns a signed Wompi Web Checkout URL.
4. `POST /api/webhooks/wompi` verifies signature, updates the purchase, extends `brand_subscriptions.paidUntil` idempotently on APPROVED.
5. Sylvanas `/dashboard/subscribe` renders three plan cards + a "current plan / renew" panel when already paid.
6. Sylvanas `/dashboard/subscribe/success` polls the latest purchase for up to 30s and shows outcome.
7. Extend `TrialBanner` with a "vence en X días" warning at ≤5 days for paid brands.

## Non-goals

- Auto-recurring debit (Payment Sources, cron scheduler). Separate spec.
- Wallet, tokens, boosts, top services.
- Plan downgrades or refunds.
- DIAN electronic invoicing.
- Rate limiting on the webhook.

## Renewal semantics

`newPaidUntil = max(now, current.paidUntil ?? 0) + product.durationDays * 86400 * 1000`

Buying early extends. Buying after expiry resets from now. Applies to same-plan renewal AND plan upgrade — days always add. This is the only semantics; no proration.

## Data model

### `products` (new)

```
products
  id                text primary key
  code              text unique not null       -- 'sub_monthly' | 'sub_semester' | 'sub_annual'
  type              text not null              -- 'SUBSCRIPTION' | 'TOKEN_PACK' (future)
  displayName       text not null              -- "Mensual", "Semestral", "Anual"
  priceCop          integer not null           -- COP whole units, e.g. 85000
  durationDays      integer                    -- 30, 180, 365; null for token packs
  tokensGranted     integer                    -- null today; populated by tokens spec
  isActive          integer not null default 1
  createdAt         integer not null
  updatedAt         integer not null
```

Migration `0004_products_and_purchases.sql` creates the table and seeds the three subscription rows.

### `purchases` (new)

```
purchases
  id                 text primary key
  brandId            text not null references brands(id)
  productId          text not null references products(id)
  userId             text not null references users(id)    -- who initiated
  amountCop          integer not null                       -- snapshot of product.priceCop at purchase time
  status             text not null                          -- 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
  wompiReference     text unique not null                   -- ULID we generate
  wompiTransactionId text                                   -- id Wompi assigns on approval; null while PENDING
  paidAt             integer                                -- ms since epoch when status flipped to APPROVED
  createdAt          integer not null
  updatedAt          integer not null
```

Unique index on `wompiReference`. Non-unique index on `(brandId, createdAt DESC)` for "latest purchase" queries.

### `brand_subscriptions` (unchanged shape)

On APPROVED webhook, update in place: `tier='paid'`, `status='active'`, `paidUntil=<computed>`, `trialEndsAt=null`, `updatedAt=now`.

## Wompi environment configuration

Thrall env vars (Vercel project `thrall`):
- `WOMPI_PUBLIC_KEY` (e.g. `pub_test_...`)
- `WOMPI_PRIVATE_KEY` (e.g. `prv_test_...`) — kept server-side, never exposed
- `WOMPI_INTEGRITY_SECRET` (used to sign checkout URL)
- `WOMPI_EVENTS_SECRET` (used to verify webhook signature)
- `WOMPI_ENV` = `test` | `prod` — selects checkout base URL: `https://checkout.wompi.co/p/` for both, but the public key prefix drives whether Wompi treats it as sandbox
- `SYLVANAS_URL` — for building the `redirect-url` back to sylvanas

Sylvanas env vars: none new.

Wompi merchant dashboard configuration:
- **URL de Eventos:** `https://thrall-delta.vercel.app/api/webhooks/wompi`

## Checkout flow

1. User at `/dashboard/subscribe` clicks "Elegir plan" on a card.
2. Sylvanas server action calls `POST /api/brand/subscribe { productId }` in thrall (with the user's cookie/JWT).
3. Thrall:
   - Auth check via existing `authMiddleware`.
   - Load `product` by `id`. If missing, inactive, or `type != 'SUBSCRIPTION'` → 400 `{ error: 'invalid_product' }`.
   - Generate `reference = newId()` (ULID).
   - `INSERT INTO purchases (brandId=caller.brandId, productId, userId=caller.sub, amountCop=product.priceCop, status='PENDING', wompiReference=reference)`.
   - Compute `amountInCents = product.priceCop * 100`.
   - Compute integrity signature: `sha256(reference + amountInCents + 'COP' + WOMPI_INTEGRITY_SECRET)` (hex).
   - Build URL: `https://checkout.wompi.co/p/?public-key=<pub>&currency=COP&amount-in-cents=<cents>&reference=<ref>&redirect-url=<encoded SYLVANAS_URL/dashboard/subscribe/success>&signature:integrity=<sig>`.
   - Return `{ checkoutUrl }`.
4. Sylvanas server action returns the URL; the client-side handler calls `window.location.href = checkoutUrl`.
5. User pays on Wompi hosted page.
6. Wompi redirects to `${SYLVANAS_URL}/dashboard/subscribe/success?id=<transactionId>&env=test`.
7. Sylvanas `/dashboard/subscribe/success` polls `GET /api/brand/purchases/latest`:
   - Every 2s, up to 30s total.
   - Stops when latest purchase is APPROVED / DECLINED / VOIDED / ERROR, or timeout.
   - UI states: `procesando` → `aprobado` (green, link "Ir al dashboard") / `rechazado` (red, "Intentar de nuevo" back to `/dashboard/subscribe`) / `timeout` (yellow, "Wompi sigue procesando — revisa en unos minutos").

The redirect exists for UX only. The webhook is authoritative for subscription state.

## Webhook

`POST /api/webhooks/wompi` — public, no auth middleware, exempted from `requirePaid`.

Payload (per Wompi docs):
```json
{
  "event": "transaction.updated",
  "data": {
    "transaction": {
      "id": "01-...",
      "reference": "01HR...",
      "status": "APPROVED",
      "amount_in_cents": 8500000,
      ...
    }
  },
  "sent_at": "2026-07-16T22:00:00.000Z",
  "timestamp": 1721160000,
  "signature": {
    "properties": ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
    "checksum": "abc123..."
  },
  "environment": "test"
}
```

Handler logic:

1. Read raw body. Verify signature: for each key in `signature.properties`, resolve `data.<key>` (nested); concat their string values in order + `timestamp` + `WOMPI_EVENTS_SECRET`; `sha256` (hex); compare to `signature.checksum`. Mismatch → `401 { error: 'invalid_signature' }`.
2. If `event !== 'transaction.updated'` → `200 { ok: true, ignored: 'unhandled_event' }`.
3. Look up purchase: `SELECT * FROM purchases WHERE wompi_reference = data.transaction.reference`. If none → `200 { ok: true, ignored: 'unknown_reference' }` (could be a Wompi transaction from another integration on the same merchant account).
4. Idempotency: if `purchase.status` in `('APPROVED','DECLINED','VOIDED','ERROR')` and equal to incoming Wompi status → `200 { ok: true, ignored: 'already_processed' }`. If a terminal status is already set but incoming differs, log an audit entry and still return 200 (Wompi shouldn't do this; if it happens, human review).
5. Map Wompi status → our status:
   - `APPROVED` → APPROVED
   - `DECLINED` → DECLINED
   - `VOIDED` → VOIDED
   - `ERROR` → ERROR
   - Anything else (`PENDING`) → leave purchase as PENDING, return 200.
6. Update purchase: `UPDATE purchases SET status=<new>, wompi_transaction_id=data.transaction.id, paid_at=<now if APPROVED else null>, updated_at=now WHERE id=purchase.id`.
7. If APPROVED:
   - Load `product` + current `brand_subscriptions` for `purchase.brandId`.
   - Compute `newPaidUntil = max(now, current.paidUntil ?? 0) + product.durationDays * 86400 * 1000`.
   - Update `brand_subscriptions`: `tier='paid'`, `status='active'`, `paidUntil=newPaidUntil`, `trialEndsAt=null`, `updatedAt=now`.
8. Return `200 { ok: true }`.

All these steps run in a `db.transaction()` so a partial write can't leave the DB inconsistent.

## Public product listing

`GET /api/products` — public (no auth), returns active products, optionally filtered by `?type=SUBSCRIPTION`. Used by sylvanas `/dashboard/subscribe` to render cards. Type filter defaults to `SUBSCRIPTION` when the query lacks it. Future tokens spec will call `?type=TOKEN_PACK`.

## Latest-purchase endpoint

`GET /api/brand/purchases/latest` — auth required, returns the most recent purchase for the caller's brand:

```json
{
  "id": "01HR...",
  "productCode": "sub_monthly",
  "amountCop": 85000,
  "status": "APPROVED",
  "wompiReference": "01HR...",
  "paidAt": 1721160000000,
  "createdAt": 1721159900000
}
```

Or `{ latest: null }` if the brand has no purchases yet. Used by the success page polling loop.

## Sylvanas UI

### `/dashboard/subscribe/page.tsx` (server component)

Rework the existing (post-fix) page:

- `getSubscription()` and `apiFetch<Product[]>("/products?type=SUBSCRIPTION")` in parallel.
- If `sub.isGrandfathered`: render "Cuenta especial — no requiere suscripción" and stop.
- If `sub.isPaidEffective` and NOT grandfathered: render a top card "Estás en `<displayName>`, vence `<formatted date>`" + "Renovar / cambiar plan" section with the 3 product cards.
- Otherwise (FREE, trial, expired): render the 3 product cards with prominent CTAs.

Each product card shows `displayName`, price (formatted COP), duration in days, and a "Elegir plan" button. Clicking triggers a client-side handler that calls the server action → gets `checkoutUrl` → `window.location.href = checkoutUrl`.

### `/dashboard/subscribe/success/page.tsx` (new, client component)

- Reads `?id` and `?env` from search params.
- On mount, starts polling `/api/brand-purchases-latest` (new Next Route Handler that proxies to thrall's `/brand/purchases/latest`, mirroring the pattern from `brand-subscription/route.ts`).
- States rendered: procesando (spinner + "Estamos confirmando tu pago con Wompi..."), aprobado (green card, "¡Suscripción activa!" + link to `/dashboard`), rechazado (red card, "El pago no se completó" + link back to `/dashboard/subscribe`), timeout (yellow card, "Wompi sigue procesando — te notificaremos" + link to `/dashboard`).

### Banner extension

Modify `sylvanas/components/shared/TrialBanner.tsx`:
- Existing trial + trial-expired branches unchanged.
- New branch: if `tier === 'paid' && status === 'active' && daysLeft !== null && daysLeft <= 5 && daysLeft > 0` → amber "Tu plan vence en X día(s) — [Renovar]" linking to `/dashboard/subscribe`.
- New branch: if `tier === 'paid' && !isPaidEffective` → red "Tu plan venció — [Renovar]".
- Grandfathered still short-circuits to `null`.

## Backend structure (thrall)

New / modified files:
- `src/db/schema.ts` — add `products`, `purchases` tables + indexes.
- `migrations/0004_products_and_purchases.sql` — create tables + seed 3 products.
- `src/lib/wompi.ts` — pure helper module: `buildCheckoutUrl(product, reference)`, `verifyWebhookSignature(payload, signature, timestamp)`, `computeNewPaidUntil(current, product)`. No DB access; unit-testable in isolation.
- `src/routes/products.ts` — `GET /api/products`.
- `src/routes/brand.ts` — replace stub `POST /subscribe` with real body; add `GET /purchases/latest`.
- `src/routes/webhooks.ts` — new file: `POST /wompi`.
- `src/app.ts` — mount `productsRoutes` at `/products`, mount `webhooksRoutes` at `/webhooks`.
- `tests/lib/wompi.test.ts` — unit tests for the 3 helpers.
- `tests/routes/subscribe.test.ts` — integration for `POST /brand/subscribe`.
- `tests/routes/webhook-wompi.test.ts` — integration for signature verify, idempotency, APPROVED flow.
- `tests/routes/products.test.ts` — public listing.

## Frontend structure (sylvanas)

New / modified files:
- `app/dashboard/subscribe/page.tsx` — rewrite (per above).
- `app/dashboard/subscribe/actions.ts` — new server action `createCheckout(productId)` calling thrall.
- `app/dashboard/subscribe/success/page.tsx` — new client component.
- `app/api/brand-purchases-latest/route.ts` — new Route Handler proxy.
- `components/shared/TrialBanner.tsx` — add paid-expiring/expired branches.

## Testing

**Unit (thrall):**
- `buildCheckoutUrl`: URL contains expected query params + integrity signature matches hand-computed value.
- `verifyWebhookSignature`: valid payload passes; tampered `amount_in_cents` fails; missing property fails.
- `computeNewPaidUntil`: expired → now+days; active with N days left → paidUntil+days; grandfathered treated as active baseline (test both max branches).

**Integration (thrall + Turso test DB):**
- `POST /api/brand/subscribe`:
  - Happy path: PAID product returns URL, `purchases` row inserted with PENDING.
  - Missing/inactive product → 400.
  - No auth → 401.
- `POST /api/webhooks/wompi`:
  - Bad signature → 401.
  - Unknown reference → 200 ignored.
  - Duplicate APPROVED payload → 200 ignored, no double-extension of `paidUntil`.
  - APPROVED on FREE-expired brand → `brand_subscriptions.paidUntil = now + planDays`, `tier='paid'`, `status='active'`.
  - APPROVED on paid-active brand with 20 days left → new `paidUntil = old paidUntil + planDays`.
  - DECLINED → `purchases.status='DECLINED'`, `brand_subscriptions` untouched.
- `GET /api/products?type=SUBSCRIPTION` returns the 3 seeded rows.
- `GET /api/brand/purchases/latest` returns the most recent purchase for the brand.

**Manual sandbox (documented in the plan, not automated):**
- Full round-trip using Wompi test card `4242 4242 4242 4242` → checkout → approved webhook → dashboard shows paid state + banner disappears.

## Rollout

1. thrall migration 0004 applied to prod Turso.
2. Wompi merchant dashboard: set URL de Eventos to prod webhook.
3. Configure the 5 Wompi env vars + `SYLVANAS_URL` in Vercel (thrall project).
4. Deploy thrall + sylvanas.
5. Manual sandbox test end-to-end.
6. Switch `WOMPI_ENV=prod` and swap public/private/integrity/events secrets when merchant is approved for production.

## Open questions parked

- Auto-recurring debit → separate spec.
- Wallet, tokens, boosts → their own specs.
- Email receipt on approval → future.
- Password reset, email verification → separate quality/security spec.
