# Multi-tenancy: FREE / PAID tiers + public signup + trial

Date: 2026-07-15
Status: Draft — pending user review

## Context

Arthas is pivoting to a SaaS model where multiple modeling agencies (brands) can sign up and use the platform. The multi-tenant foundation already exists: `brands` table, `users.brandId` NOT NULL, and a minimal `brand_subscriptions` table with `plan` and `paidUntil` fields. Currently only one real brand exists (test), and brand creation is manual by the `dev` super-admin.

This spec formalizes two tiers of access — FREE and PAID — introduces a 10-day trial for new signups as a conversion hook, and enables public self-signup from illidan. It intentionally does NOT include the payment integration (Wompi), wallet, tokens, or boosts — those are separate specs. What this spec does include is the data shape and hooks necessary for Wompi to plug in later without rework.

## Goals

1. Formalize `tier ∈ {free, paid}` with a `status` and trial support on `brand_subscriptions`.
2. Allow anyone to create a brand + admin user via a public signup form.
3. Grant new signups a 10-day full-feature trial that auto-expires to FREE.
4. Enforce feature gating in thrall (403) and sylvanas (UI + upsell) on the boundary defined below.
5. Preserve existing brand data by marking today's brand as PAID grandfathered.

## Non-goals

- Wompi checkout, webhooks, or any real payment flow (separate spec).
- Wallet, tokens, products, purchases, boosts, top services (separate specs).
- Email verification, captcha, or terms/conditions acceptance (MVP accepts these gaps).
- Password reset (out of scope, tracked separately).
- Brand deletion or brand transfer flows.

## Feature boundary: FREE vs PAID

FREE brands can:
- CRUD their own models (`/api/models`, `/api/images`).
- Create additional users **only with `role='model'`**. Not `admin`, not `monitor`.
- Their models appear in illidan public listing exactly like PAID brands' models.

FREE brands cannot (thrall returns `403 { error: 'subscription_required' }`; sylvanas shows upsell):
- `/api/services` (and service extras)
- `/api/pay-methods`
- `/api/fines`
- `/api/loans`
- `/api/payments`
- `/api/reports`
- Creating users with `role='admin'` or `role='monitor'` via `/api/users`.

PAID brands (or brands in an active trial) have full access to everything a FREE brand has plus all the gated routes above. The `dev` role bypasses all gating (cross-brand super-admin behavior is unchanged).

**Ranking / boost visibility on illidan is deferred to the tokens/boosts spec.** For this spec, illidan listing order stays as-is today.

## Data model

### Changes to `brand_subscriptions`

Replace the current shape with:

```
brand_subscriptions
  id                text primary key
  brandId           text not null references brands(id)   -- unique (one row per brand)
  tier              text not null                          -- 'free' | 'paid'
  status            text not null                          -- 'active' | 'trial' | 'expired'
  trialEndsAt       integer nullable                       -- unix seconds; set when status='trial'
  paidUntil         integer nullable                       -- unix seconds; set when tier='paid' & status='active'
  isGrandfathered   integer not null default 0             -- 1 for the pre-existing brand
  createdAt         integer not null
  updatedAt         integer not null
```

One row per brand (unique index on `brandId`). The row is mutated over time rather than kept as history; purchase history will live in the future `purchases` table (Wompi spec).

Dropped fields: `plan` (replaced by `tier`), `isActive` (replaced by `status`).

### Effective-access rule

A brand is "PAID-effective" (has full feature access) iff **any** of:

1. `status = 'trial' AND trialEndsAt > now`, or
2. `tier = 'paid' AND status = 'active' AND paidUntil > now`, or
3. `isGrandfathered = 1`.

Otherwise the brand is FREE.

Trial expiry and paid expiry are computed lazily on each request via the middleware; no cron job. When a check finds `trialEndsAt <= now` (or `paidUntil <= now` for paid), the middleware updates the row to `status='expired'` and denies the request if applicable.

### Migration

The single existing brand receives a `brand_subscriptions` row with `isGrandfathered=1`, `tier='paid'`, `status='active'`, `paidUntil=NULL`. Its existing row (if any) is replaced.

## Signup flow

### illidan

Add a "Forma parte" CTA in the navbar (and optionally footer) linking to `${SYLVANAS_URL}/signup`. No new dependency on thrall.

### sylvanas `/signup`

Public page (excluded from the auth middleware). Form fields:

- Nombre de la agencia (brand name)
- Tu nombre (admin display name)
- Email
- Password
- Confirmar password

Client-side validation only for password match + basic email shape. Server is authoritative for everything else.

On submit, calls `POST ${THRALL_URL}/api/auth/signup`. On success, receives a JWT, sets the `arthas_token` httpOnly cookie via a Next server action (same mechanism as `/login`), and redirects to `/dashboard`.

### thrall `POST /api/auth/signup` (public)

Request body:
```json
{ "brandName": "...", "adminName": "...", "email": "...", "password": "..." }
```

Server logic (all in one transaction):
1. Trim + lowercase email. Trim brand name.
2. Reject if `users.email` already exists (409).
3. Reject if a brand with the same name (case-insensitive) already exists (409).
4. Reject if password length < 8 (400).
5. Create `brands` row (`isActive=1`).
6. Create `brand_subscriptions` row: `tier='free'`, `status='trial'`, `trialEndsAt=now+10 days`, `isGrandfathered=0`.
7. Create `users` row: `role='admin'`, `brandId=<new brand>`, password hashed with the existing bcrypt helper.
8. Return `{ token }` (same JWT shape as `/login`).

Rate limiting is out of scope for this spec (accepted MVP risk).

## Feature gating implementation

### thrall middleware

Add `middleware/requirePaid.ts`. It:
- Reads the current user's brand from `c.get('user')` (already set by auth middleware).
- Loads the brand's `brand_subscriptions` row (cached per-request).
- If the effective-access rule passes, `await next()`.
- Otherwise responds `403 { error: 'subscription_required', reason: 'trial_expired' | 'no_subscription' | 'paid_expired' }`.
- If lazy expiry is triggered, updates the row's `status` to `'expired'` before denying.
- `dev` role bypasses (returns `next()` immediately).

Mounted on: `/api/services/*`, `/api/pay-methods/*`, `/api/fines/*`, `/api/loans/*`, `/api/payments/*`, `/api/reports/*`.

Inside `/api/users` `POST` handler: additional check — if creating role `admin` or `monitor` and brand is not PAID-effective, return the same 403. Creating role `model` is always allowed for admins.

### thrall `GET /api/brand/subscription` (new)

Returns the current user's brand subscription state:
```json
{
  "tier": "free" | "paid",
  "status": "active" | "trial" | "expired",
  "trialEndsAt": 1721001600 | null,
  "paidUntil": 1721001600 | null,
  "isGrandfathered": false,
  "isPaidEffective": true,
  "daysLeft": 7 | null
}
```

`daysLeft` is computed from whichever of `trialEndsAt` or `paidUntil` is active. Used by sylvanas to render the banner.

### thrall `POST /api/brand/subscribe` (stub for Wompi)

Placeholder endpoint that today returns `501 { error: 'not_implemented', contact: '<whatsapp url>' }`. Wompi spec will replace the body. Sylvanas' "Suscríbete" CTA POSTs here and shows the returned message. This keeps the UI wiring stable across the two specs.

### sylvanas UI

- **`useSubscription()` hook** — fetches `/api/brand/subscription` once on dashboard mount, caches in a context, exposes `{ isPaidEffective, daysLeft, tier, status, ... }`.
- **Sidebar** — all sections stay visible. Locked sections render with a 🔒 icon when `!isPaidEffective`.
- **Locked pages** — when a FREE brand navigates to `/dashboard/services` (etc.), the page renders a full-width upsell card instead of the normal content: title, benefits list, "Suscríbete" CTA. The CTA calls `POST /api/brand/subscribe` (stub for now).
- **Trial banner** — top-of-dashboard banner shown when `status='trial'`: "Trial: X días restantes — Suscribirse". When `status='expired'` and `tier='free'`, banner turns red: "Tu trial terminó. Suscríbete para recuperar el acceso."
- **`/dashboard/users`** — the "crear usuario" form hides the `admin` and `monitor` role options for FREE brands and shows an inline hint linking to the upsell.

No changes to any existing accounting page's internals — the gate lives at the route boundary.

## Illidan changes

Only two things:
1. Add "Forma parte" link (navbar + optional footer) pointing to `${SYLVANAS_URL}/signup`.
2. Nothing else. Model listing is unchanged.

`SYLVANAS_URL` becomes a new required env var in illidan.

## Testing

- **thrall** — vitest integration tests hitting the real Turso test DB:
  - `POST /api/auth/signup` happy path, dup email, dup brand name, short password.
  - `requirePaid` middleware: FREE brand → 403 on `/api/services`; trial brand → 200; expired trial → 403 and row status flipped to `'expired'`; grandfathered brand → 200; `dev` bypass.
  - `POST /api/users`: FREE brand admin creating `model` → 201; creating `admin` or `monitor` → 403.
  - `GET /api/brand/subscription`: shape check + `daysLeft` math.
- **sylvanas** — vitest for the `useSubscription` hook (mocked fetch), and one Playwright/E2E-style test that walks signup → dashboard → sees trial banner → visits `/dashboard/services` and sees upsell. (If Playwright isn't already wired, keep this manual and note it.)
- **illidan** — visual check only; the CTA is a link.

## Rollout

1. thrall migration: reshape `brand_subscriptions`, insert grandfathered row for the existing brand, deploy.
2. thrall code: `/api/auth/signup`, `/api/brand/subscription`, `/api/brand/subscribe` stub, `requirePaid` middleware, `/api/users` guard.
3. sylvanas: `/signup` page, `useSubscription` hook, banner, sidebar locks, upsell pages, users form gate.
4. illidan: "Forma parte" CTA + `SYLVANAS_URL` env.
5. Manually smoke-test the signup → trial → expiry path (can shorten `trialEndsAt` to a few minutes for the test brand).

## Open questions (parked for future specs)

- Wompi checkout + webhook + how `POST /api/brand/subscribe` actually charges → **Wompi spec**.
- Wallet, tokens, products, purchases tables → **Tokens spec**.
- Boosts and illidan ranking by boost → **Boosts spec**.
- Email verification, password reset, captcha → separate quality/security spec.
