# thrall — Musa backend

Hono + Drizzle ORM + Turso (libSQL). The single source of truth: auth
(JWT), tenancy, all business data, and the Wompi payment webhook. Both
`sylvanas` (admin dashboard) and `illidan` (public showcase) talk to
this over HTTP.

See the [monorepo README](../README.md) for the product overview.

## Local dev

```bash
npm install
npm run dev              # http://localhost:8787 by default
npm test                 # vitest
npm run db:migrate       # apply Drizzle migrations to whatever DB env vars point at
```

Requires `.env` with `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
`JWT_SECRET`, and the five `WOMPI_*` variables (see `.env.example`).

## Deploy

Vercel builds do NOT run the Hono bundle — we ship a **pre-bundled** file:

```bash
npm run build            # tsup -> dist/index.mjs
git add dist/index.mjs && git commit
```

Vercel's config picks up `dist/index.mjs` directly. So after **every**
src/ change: build + commit the regenerated bundle. CI won't catch this.

## Layout

- `src/routes/` — one file per resource: `auth`, `brands`, `brand`,
  `users`, `models`, `images`, `services`, `pay-methods`, `fines`,
  `loans`, `payments`, `reports`, `products`, `top-services`, `webhooks`.
- `src/middleware/` — `auth.ts` (JWT), `rbac.ts` (role gates),
  `requirePaid.ts` (subscription gate + `loadBrandAccess` helper).
- `src/lib/` — pure helpers: `wompi.ts` (checkout URL sig + webhook sig
  + paidUntil math), `wallet.ts` (discount + boost expiry), `jwt.ts`,
  `hash.ts`, `ulid.ts`.
- `src/db/schema.ts` — one file with every table.
- `migrations/` — Drizzle SQL migrations (sequential `00XX_*.sql`).

## Notes

- Public endpoints (`GET /api/models`, `GET /api/models/:id`,
  `GET /api/products`, `GET /api/top-services`, `POST /api/webhooks/wompi`,
  `POST /api/auth/signup`, `POST /api/auth/login`) have no
  `authMiddleware`. All others require it.
- `requirePaid` gates the accounting routes (`services`, `pay-methods`,
  `fines`, `loans`, `payments`, `reports`) and admin/monitor user creation.
- `dev` role bypasses all tenancy and subscription gates.
- Wompi webhook is idempotent and cross-checks the transaction amount
  against the stored purchase snapshot before crediting.
