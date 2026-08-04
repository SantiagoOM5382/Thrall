# illidan — Musa public showcase

Next.js 15 App Router. The public-facing site where visitors browse
published models, hover to see an animated preview, and click through to
contact the model by WhatsApp / Telegram.

See the [monorepo README](../README.md) for the product overview.

## Local dev

```bash
npm install
npm run dev   # http://localhost:3001
```

Requires `THRALL_URL` pointing at the backend (public endpoints only —
this app is unauthenticated). Copy `.env.local.example` → `.env.local`.

## Layout

- `app/page.tsx` — landing grid of active models (ISR 1h).
- `app/models/[id]/page.tsx` — profile detail (SSG via
  `generateStaticParams`, dynamic `generateMetadata` for OG previews).
- `app/legal/{terminos,privacidad}/page.tsx` — legal pages linked from
  the footer.
- `app/sitemap.ts` — dynamic sitemap including every published model URL.
- `components/age-gate.tsx` — client-side 18+ overlay, cookie-based, does
  not block SEO indexing.
- `components/model-card-media.tsx` — the hover-to-play preview player
  (mp4/webm autoplays muted-looped on hover; gif animates natively).
- `components/model-modal.tsx` — the "quick view" modal opened from the
  grid.

## Env vars

- `THRALL_URL` — backend base URL.
- `NEXT_PUBLIC_SYLVANAS_URL` — where the "Forma parte" and "Ingresar"
  CTAs point.
- `NEXT_PUBLIC_SITE_URL` — the canonical origin of the deployed site,
  used to build absolute URLs in the sitemap (defaults to `https://musa.co`
  if unset).

## Notes

- Public models listing filters out models with no `phone` and no
  `telegram` — visitors need a way to contact them.
- Model PII (email, brandId, role, timestamps) is NEVER included in the
  public API response — only what's needed to display and contact.
