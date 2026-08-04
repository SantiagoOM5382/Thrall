# sylvanas — Musa admin dashboard

Next.js 15 App Router. The dashboard where agency admins and independent
models manage everything: model profiles, photos, animated previews,
services, finances, tokens, boosts and their subscription.

See the [monorepo README](../README.md) for the product overview.

## Local dev

```bash
npm install
npm run dev   # http://localhost:3000
```

Requires `thrall` running (or `THRALL_URL` pointing at the deployed
backend). Copy `.env.local.example` → `.env.local`.

## Layout

- `app/dashboard/` — authenticated routes (services, models, users,
  earnings, reports, subscribe, tokens, brands, profile).
- `app/login`, `app/signup` — public auth flows.
- `components/` — UI (shadcn/ui in `components/ui`, dashboard-specific
  in `components/layout` and `components/dashboard`, shared/gated widgets
  in `components/shared`).
- `lib/` — server-only helpers (`apiFetch` proxies to thrall with the
  session cookie; `subscription-server` centralises the sub check).
- `middleware.ts` — gates `/dashboard/*` and `/login|/signup` on the JWT
  cookie.

## Notes

- Do NOT rename `arthas_token` cookie without a migration story — existing
  sessions live in that name.
- Do NOT upgrade Next.js or `@next/swc` without validating on WSL2 (see
  the parent repo's memory on Next 15 / SWC pin).
