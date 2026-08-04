# Musa

Multi-tenant SaaS for modeling agencies (and independent models) in
Colombia. Two connected products in one monorepo:

- **Panel administrativo** (`sylvanas/`) — dashboard where each agency /
  independent model manages their models, services, finances, tokens and
  subscription. Revenue: monthly / semestral / annual subscription plans.
- **Vitrina pública** (`illidan/`) — public showcase where visitors browse
  published models, contact them by WhatsApp / Telegram, and see animated
  hover previews. Free for the public. Revenue: tokens spent by agencies to
  boost model visibility.

Both apps talk to the same backend (`thrall/`) which owns the database,
authentication, payment webhooks (Wompi) and business logic.

## Layout

| Directory | Stack | Deployed as |
|---|---|---|
| `thrall/` | Hono + Drizzle + Turso (libSQL) | `thrall-*.vercel.app` |
| `sylvanas/` | Next.js 15 + Tailwind + shadcn/ui | The admin dashboard |
| `illidan/` | Next.js 15 + Tailwind | The public showcase |
| `docs/superpowers/` | Specs + implementation plans | Read-only reference |

Each project is a **separate Vercel deployment** with its own Root
Directory. They share nothing at build time, only at runtime via HTTP.

## Business rules (essentials)

- Two kinds of accounts (`brands.kind`): `agency` and `solo`. Agencies can
  publish many models; solo brands publish exactly one (the model herself).
- Two revenue streams: subscriptions ($60k / $250k / $500k COP for
  monthly / semestral / annual) and tokens ($50k / $90k / $150k / $200k
  COP for 100k / 200k / 400k / 600k token packs).
- Subscriptions grant 20% / 35% / 60% discount on token purchases while
  active.
- Tokens are spent on time-limited boosts (15min / 1h / 4h / 24h) that
  push a model to the top of the illidan listing.
- All new brands get a 10-day trial with full paid features.

## Local dev

Each project runs standalone:

```bash
cd thrall && npm install && npm run dev
cd sylvanas && npm install && npm run dev
cd illidan && npm install && npm run dev
```

See each subdir's `.env.local.example` / `.env.example` for required
environment variables. `thrall` needs `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, `JWT_SECRET`, and the five `WOMPI_*` variables.
`sylvanas` and `illidan` need `THRALL_URL` pointing at the backend.

## Deploy

1. `git push origin master` — Vercel picks up all three projects.
2. Thrall bundles at build time (`tsup → dist/index.mjs`, committed) —
   after any src change in thrall, run `npm run build` locally and
   commit the regenerated bundle.
3. Migrations live in `thrall/migrations/`. Apply to prod with
   `cd thrall && npm run db:migrate` against the prod Turso credentials.
