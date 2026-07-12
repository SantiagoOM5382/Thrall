# Illidan — Vitrina Pública

**Fecha:** 2026-07-12
**Estado:** Aprobado
**Proyectos afectados:** `illidan` (nuevo), `sylvanas` (se reduce a dashboard)
**Backend:** `thrall` (sin cambios — usa endpoints públicos existentes)

---

## 1. Visión

Separar la vitrina pública (mostrar modelos) del panel administrativo.
`illidan` pasa de "reservado para auth" a ser un Next.js 15 público, sin auth,
que consume `GET /api/models` y `GET /api/models/:id` de thrall. `sylvanas`
queda como panel administrativo puro (`/dashboard/*` + login).

## 2. illidan — estructura

```
illidan/
├── app/
│   ├── layout.tsx              fuentes + metadata
│   ├── page.tsx                landing: galería de modelos activas (ISR revalidate 3600)
│   └── models/[id]/page.tsx    perfil público (SSG + generateStaticParams)
├── components/
│   ├── ui/                     shadcn mínimo (card, button)
│   └── model-avatar.tsx
├── lib/
│   ├── api.ts                  solo apiFetchPublic + ApiError
│   ├── types.ts                Model, ModelImage
│   └── utils.ts                cn
└── .env.local.example          THRALL_URL=https://thrall-delta.vercel.app
```

- Sin dinero: la vitrina no muestra precios/ganancias.
- Botones de contacto: WhatsApp (desde `phone`), Telegram (desde `telegram`).
- Stack idéntico a sylvanas (Next 15.5.19, Tailwind v4, shadcn base-ui), pinneando
  el binario `@next/swc-linux-x64-gnu` para evitar el bus error (ver memoria
  sylvanas-dev-env).
- Env: solo `THRALL_URL` (público, sin JWT_SECRET — no hay auth).
- Deploy: proyecto Vercel nuevo, root dir `illidan`.

## 3. sylvanas — se reduce a dashboard

- **Eliminar** `app/page.tsx` (landing pública) y `app/models/[id]/` (perfil público).
  NO tocar `app/dashboard/models/[id]/` (gestión admin — es distinto).
- **Nuevo** `app/page.tsx`: redirige a `/dashboard` (que redirige por rol) — el
  middleware manda a `/login` si no hay sesión.
- **Eliminar** `apiFetchPublic` de `lib/api.ts` y `components/shared/model-avatar.tsx`
  (ya no se usan tras quitar las páginas públicas).

## 4. Decisiones

| Decisión | Razón |
|---|---|
| Duplicar código compartido (Model, apiFetchPublic, ModelAvatar, cn) | Es poco; un paquete compartido es sobre-ingeniería para el piloto |
| illidan sin auth ni JWT_SECRET | Vitrina pública; nada sensible |
| thrall sin cambios | Endpoints públicos ya existen |
| illidan repurposado (era "auth reservado") | No hay auth-service separado en el piloto |

## 5. Plan de ejecución (inline)

1. Scaffold `illidan` (create-next-app Next 15 + Tailwind, deps mínimas, shadcn card+button, SWC binary pinned).
2. Crear `lib/{types,api,utils}.ts`, `components/model-avatar.tsx`, `.env.local` + `.env.local.example`.
3. Crear `app/page.tsx` (landing) y `app/models/[id]/page.tsx` (perfil), adaptados de sylvanas (sin dinero).
4. Verificar `tsc --noEmit` + `npm run build` de illidan.
5. En sylvanas: borrar páginas públicas + `model-avatar.tsx`, quitar `apiFetchPublic`, nuevo `app/page.tsx` redirect.
6. Verificar `tsc --noEmit` + `npm run build` de sylvanas.
7. Commit.
