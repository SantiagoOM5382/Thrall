# Wallet & Tokens — segunda fuente de monetización

Date: 2026-07-16
Status: Draft — pending user review

## Context

El plan de monetización original definía dos fuentes de ingreso: suscripciones
(acceso al panel administrativo, ya implementado en el spec de Wompi del
2026-07-16) y **tokens** (créditos que las brands gastan para comprar
visibilidad de sus modelos en `illidan`, la vitrina pública). Este spec cubre
la segunda fuente, reutilizando el mecanismo de checkout/webhook de Wompi ya
construido y probado.

El `products` table ya soporta `type IN ('SUBSCRIPTION', 'TOKEN_PACK')` — este
spec le da uso real al segundo tipo. El `purchases` table y el flujo de
checkout/webhook no cambian de forma; solo se extiende la rama `APPROVED` del
webhook para manejar `TOKEN_PACK` además de `SUBSCRIPTION`.

**Decisión de alcance (confirmada con el usuario):** el wallet es **por
brand**, no por usuario individual — consistente con `brand_subscriptions`,
que ya es la unidad de facturación del sistema. El documento original de
producto mencionaba `wallet` por `usuario_id`; se descarta esa granularidad
para mantener un solo modelo de tenencia.

## Goals

1. Extender `products` con filas `TOKEN_PACK` (paquetes de tokens) y un
   descuento por tier de suscripción activa.
2. `brand_wallets` — saldo de tokens por brand.
3. `wallet_transactions` — auditoría de cada movimiento (compra, gasto).
4. `POST /api/brand/purchase-tokens { productId }` — igual que
   `/brand/subscribe` pero para `TOKEN_PACK`, aplicando el descuento vigente.
5. Webhook: rama `APPROVED` con `product.type === 'TOKEN_PACK'` acredita el
   wallet en vez de extender `paidUntil`.
6. `top_services` — catálogo de productos de visibilidad (ej. "Top perfil
   24h") con costo en tokens.
7. `profile_boosts` — boost activo/expirado sobre un modelo.
8. `POST /api/models/:id/boost { topServiceId }` — gasta tokens del wallet de
   la brand dueña del modelo, crea el boost.
9. `GET /api/models` (público, consumido por illidan) prioriza modelos con
   boost activo.
10. Sylvanas: página de compra de tokens + saldo visible + botón "Destacar"
    en gestión de modelos.

## Non-goals

- Boosts a nivel de imagen individual (`Top Imagen`) o banners (`Banner
  Principal`, `Categoría destacada`) — el catálogo original los menciona pero
  el MVP solo implementa boost de perfil completo. `top_services` queda
  genérico para que agregarlos después sea solo una fila nueva, no un cambio
  de esquema.
- Bonificación inicial de tokens al comprar plan anual — se puede agregar
  como una fila más de lógica en el webhook una vez el flujo base esté
  probado; parked en "Open questions".
- Expiración automática de boosts vía cron — el estado `ACTIVE`/`EXPIRED` se
  deriva comparando `endsAt` con `now()` en cada lectura, no se escribe con un
  job periódico (igual filosofía que "no rate limiting en el webhook" del
  spec de Wompi: simplicidad primero).
- Reembolsos de tokens no gastados.
- Precios exactos de los `top_services` — ver "Open questions parked".

## Descuento por plan activo

El descuento se **deriva**, no se almacena de forma redundante: al momento de
comprar tokens, se busca la compra `SUBSCRIPTION` `APPROVED` más reciente de
la brand (`purchases` JOIN `products` WHERE `purchases.brandId = ? AND
products.type = 'SUBSCRIPTION' AND purchases.status = 'APPROVED' ORDER BY
purchases.createdAt DESC LIMIT 1`), se lee `product.tokenDiscountPercent`, y
se aplica sobre `TOKEN_PACK.priceCop` para calcular el monto a cobrar. Si la
brand no tiene ninguna compra de suscripción aprobada (ej. está en trial),
`tokenDiscountPercent = 0`.

Esto evita una columna que se desincroniza (`brand_subscriptions` no sabe
*qué plan* se compró, solo `tier`/`paidUntil`) y refleja automáticamente el
último plan realmente pagado.

Tabla de descuentos (del plan original, confirmar antes de implementar):

| Plan | `tokenDiscountPercent` |
|---|---|
| `sub_monthly` | 20 |
| `sub_semester` | 35 |
| `sub_annual` | 60 |

## Data model

### `products` (extender, no migración destructiva)

Agregar columna:

```
tokenDiscountPercent   integer   -- % descuento en compra de tokens si este plan está activo; null para TOKEN_PACK
```

Migración `0005_wallet_tokens.sql` hace `ALTER TABLE products ADD COLUMN
token_discount_percent INTEGER` y actualiza los 3 productos `SUBSCRIPTION`
existentes con los valores de la tabla de arriba. Además siembra N filas
`TOKEN_PACK` (paquetes de tokens, precios del plan original — confirmar):

| code | displayName | priceCop | tokensGranted |
|---|---|---|---|
| `tokens_100` | 100 tokens | 10.000 | 100 |
| `tokens_500` | 500 tokens | 40.000 | 500 |
| `tokens_1500` | 1500 tokens | 100.000 | 1500 |

(`durationDays` queda `NULL` para `TOKEN_PACK`, como ya contempla el schema.)

### `brand_wallets` (new)

```
brand_wallets
  id              text primary key
  brandId         text not null references brands(id)
  tokensBalance   integer not null default 0
  createdAt       integer not null
  updatedAt       integer not null
```

Unique index en `brandId` (una fila por brand, igual patrón que
`brand_subscriptions`). Se crea de forma perezosa: si no existe al momento de
la primera compra o el primer boost, se inserta con `tokensBalance = 0` antes
de aplicar el movimiento.

### `wallet_transactions` (new)

```
wallet_transactions
  id              text primary key
  brandId         text not null references brands(id)
  type            text not null            -- 'CREDIT_PURCHASE' | 'DEBIT_BOOST'
  amount          integer not null         -- siempre positivo; el signo lo da `type`
  balanceAfter    integer not null
  purchaseId      text references purchases(id)       -- set si type = CREDIT_PURCHASE
  profileBoostId  text references profile_boosts(id)  -- set si type = DEBIT_BOOST
  description     text not null
  createdAt       integer not null
```

Índice `(brandId, createdAt DESC)` para el historial paginado.

### `top_services` (new)

```
top_services
  id              text primary key
  code            text unique not null     -- 'top_perfil_24h'
  displayName     text not null            -- "Top perfil 24 horas"
  tokensCost      integer not null
  durationHours   integer not null
  isActive        integer not null default 1
  createdAt       integer not null
  updatedAt       integer not null
```

Seed inicial (precios del plan original, confirmar):

| code | displayName | tokensCost | durationHours |
|---|---|---|---|
| `top_perfil_24h` | Top perfil 24 horas | 50 | 24 |

Solo una fila para el MVP — agregar "Top Imagen", "Banner Principal", etc. es
insertar filas nuevas, sin tocar código, una vez el flujo base esté probado.

### `profile_boosts` (new)

```
profile_boosts
  id              text primary key
  modelId         text not null references users(id)   -- el modelo destacado
  brandId         text not null references brands(id)  -- dueño; valida ownership + de dónde sale el gasto
  purchasedBy     text not null references users(id)    -- admin/monitor que ejecutó la acción
  topServiceId    text not null references top_services(id)
  tokensSpent     integer not null                      -- snapshot de top_services.tokensCost
  startsAt        integer not null
  endsAt          integer not null
  createdAt       integer not null
```

Sin columna `status`: "activo" se calcula como `endsAt > now()` en cada
query. Índice `(modelId, endsAt DESC)` para resolver rápido "¿tiene boost
activo este modelo?"; índice `(brandId, createdAt DESC)` para el historial.

## Flujo de compra de tokens

Espejo exacto del flujo de suscripción, mismo `lib/wompi.ts` (sin cambios):

1. Sylvanas: página `/dashboard/tokens` (o pestaña dentro de
   `/dashboard/subscribe` — ver UI) muestra los `TOKEN_PACK` con precio ya
   descontado si aplica.
2. `POST /api/brand/purchase-tokens { productId }`:
   - Carga `product`; si no es `TOKEN_PACK` activo → 400 `invalid_product`.
   - Calcula descuento (ver sección arriba) → `amountCop = round(product.priceCop * (1 - discount/100))`.
   - Inserta `purchases` (mismo shape que hoy: `PENDING`, `amountCop`
     descontado, `wompiReference`).
   - `buildCheckoutUrl` con `amountInCents = amountCop * 100`.
   - Devuelve `{ checkoutUrl }`.
3. Usuario paga en Wompi. Redirige a
   `${SYLVANAS_URL}/dashboard/subscribe/success` — **se reutiliza la misma
   página de éxito y el mismo `GET /api/brand/purchases/latest`**, que ya
   devuelve `productCode` genérico sin asumir tipo. No hace falta una página
   de éxito nueva.
4. Webhook `POST /api/webhooks/wompi`, rama `APPROVED`:
   - Cambia el `if (status === 'APPROVED')` actual: en vez de asumir
     `SUBSCRIPTION`, ramifica por `product.type`.
   - `SUBSCRIPTION` → lógica actual sin cambios (`computeNewPaidUntil` +
     update `brand_subscriptions`).
   - `TOKEN_PACK` → `db.transaction`:
     - `INSERT OR IGNORE`/upsert `brand_wallets` si no existe (balance 0).
     - `UPDATE brand_wallets SET tokensBalance = tokensBalance +
       product.tokensGranted, updatedAt = now WHERE brandId = ?`.
     - `INSERT wallet_transactions (type='CREDIT_PURCHASE', amount =
       product.tokensGranted, balanceAfter = <nuevo balance>, purchaseId =
       purchase.id, description = 'Compra ' || product.displayName)`.
   - La idempotencia ya existente (`TERMINAL.has(purchase.status)` corta
     antes de llegar aquí) cubre ambos tipos sin cambios adicionales.

## Flujo de boost (gastar tokens)

`POST /api/models/:id/boost { topServiceId }` — auth requerida (admin o
monitor de la brand dueña del modelo).

1. Carga `model = users WHERE id = :id AND role = 'model' AND brandId =
   caller.brandId`. Si no existe o es de otra brand → 404 (no filtrar
   existencia entre brands).
2. Carga `topService` activo por id. Si no existe → 400 `invalid_service`.
3. Carga/crea `brand_wallets` para `caller.brandId`. Si `tokensBalance <
   topService.tokensCost` → 400 `insufficient_tokens`.
4. `db.transaction`:
   - `UPDATE brand_wallets SET tokensBalance = tokensBalance -
     topService.tokensCost, updatedAt = now`.
   - `INSERT profile_boosts (modelId, brandId, purchasedBy=caller.sub,
     topServiceId, tokensSpent=topService.tokensCost, startsAt=now,
     endsAt=now + topService.durationHours * 3600 * 1000)`.
   - `INSERT wallet_transactions (type='DEBIT_BOOST', amount =
     topService.tokensCost, balanceAfter = <nuevo balance>, profileBoostId =
     <boost.id>, description = 'Boost: ' || topService.displayName)`.
5. Devuelve `{ tokensBalance: <nuevo>, boost: { endsAt } }`.

No hay refund automático si el boost "no funciona" — no aplica, es solo
posicionamiento en un listado.

## Illidan — orden por boost activo

`GET /api/models` (público, sin auth, ya existe): agregar un `LEFT JOIN`
contra `profile_boosts` filtrando `endsAt > now()`, y ordenar
`ORDER BY (boost activo) DESC, <orden actual>`. Si un modelo tiene múltiples
boosts activos (edge case: compró dos), se usa el de `endsAt` más lejano para
la comparación pero no se acumulan visualmente — es una bandera booleana, no
un ranking numérico, para el MVP.

Illidan (frontend): sin páginas nuevas. El array de modelos ya viene
ordenado desde el backend; opcionalmente se agrega un badge "Destacado" en
`model-avatar.tsx` si `isBoosted` viene en la respuesta (agregar ese campo
computado, no persistido, en la respuesta de `GET /api/models`).

## Nuevos endpoints (resumen)

- `GET /api/brand/wallet` — auth. `{ tokensBalance, tokenDiscountPercent }`
  (el descuento se resuelve igual que en la compra, para mostrarlo en la UI
  antes de comprar).
- `GET /api/brand/wallet/transactions?limit=20&before=<createdAt>` — auth,
  paginado simple por cursor de fecha.
- `POST /api/brand/purchase-tokens { productId }` — auth. `{ checkoutUrl }`.
- `POST /api/models/:id/boost { topServiceId }` — auth (admin/monitor).
- `GET /api/top-services` — público o auth (igual patrón que
  `GET /api/products`), catálogo activo para armar el selector de boost.

## Sylvanas UI

- Nueva sección `/dashboard/tokens`: saldo actual + `tokenDiscountPercent`
  vigente + tarjetas de `TOKEN_PACK` (reutiliza el componente `PlanCards`
  generalizándolo para que reciba `purchaseAction` como prop en vez de
  importar `createCheckout` de suscripción directamente — evita duplicar el
  polling/success, que ya es genérico).
- `TrialBanner`/sidebar: mostrar saldo de tokens en el header del dashboard
  (fuera de alcance detallar el componente exacto aquí; se resuelve en el
  plan de implementación).
- Gestión de modelos (`/dashboard/models` o el detalle de un modelo): botón
  "Destacar" que abre un selector de `top_services` con su costo, muestra el
  saldo actual, deshabilita si no alcanza, y confirma con countdown de
  expiración tras comprar.

## Backend structure (thrall)

- `src/db/schema.ts` — `tokenDiscountPercent` en `products`; nuevas tablas
  `brandWallets`, `walletTransactions`, `topServices`, `profileBoosts`.
- `migrations/0005_wallet_tokens.sql`.
- `src/lib/wallet.ts` — helpers puros: `applyDiscount(priceCop, percent)`,
  `computeBoostExpiry(now, durationHours)`. Unit-testable, mismo patrón que
  `lib/wompi.ts`.
- `src/routes/brand.ts` — agregar `purchase-tokens`, `wallet`,
  `wallet/transactions`.
- `src/routes/models.ts` — `POST /:id/boost`; modificar `GET /` para el
  join de boost activo.
- `src/routes/top-services.ts` — nuevo, `GET /`.
- `src/routes/webhooks.ts` — ramificar `APPROVED` por `product.type`.
- `src/app.ts` — montar `topServicesRoutes`.
- Tests: `tests/lib/wallet.test.ts`, `tests/routes/purchase-tokens.test.ts`,
  `tests/routes/boost.test.ts`, extender
  `tests/routes/webhook-wompi.test.ts` con el caso `TOKEN_PACK`.

## Frontend structure (sylvanas)

- `app/dashboard/tokens/page.tsx`, `app/dashboard/tokens/actions.ts`.
- Generalizar `app/dashboard/subscribe/PlanCards.tsx` → mover a
  `components/shared/ProductCards.tsx` con `purchaseAction` inyectable,
  reutilizado por `/dashboard/subscribe` y `/dashboard/tokens`.
- Componente `BoostButton` en la gestión de modelos.
- `app/api/brand-wallet/route.ts` — proxy, mismo patrón que
  `brand-purchases-latest`.

## Testing

**Unit:** `applyDiscount` (0%, 20%, 35%, 60%, redondeo), `computeBoostExpiry`.

**Integration:**
- `POST /api/brand/purchase-tokens`: aplica descuento correcto según última
  suscripción `APPROVED`; sin suscripción → 0% descuento; producto no
  `TOKEN_PACK` → 400.
- Webhook `APPROVED` sobre `TOKEN_PACK`: crea `brand_wallets` si no existe,
  acredita `tokensGranted`, inserta `wallet_transactions`, idempotente en
  duplicado (reutiliza el guard `TERMINAL` existente).
- `POST /api/models/:id/boost`: descuenta tokens, crea `profile_boosts`,
  rechaza con 400 si saldo insuficiente, rechaza con 404 si el modelo es de
  otra brand.
- `GET /api/models`: modelo con boost activo aparece primero; boost vencido
  (`endsAt` en el pasado) no afecta el orden.

## Rollout

1. Migración `0005_wallet_tokens.sql` a Turso prod (mismo procedimiento que
   `0004`).
2. Confirmar precios reales de `TOKEN_PACK` y `top_services` con el usuario
   antes de sembrar (ver "Open questions parked").
3. Deploy thrall + sylvanas.
4. Smoke test manual: comprar un paquete de tokens con tarjeta sandbox,
   confirmar acreditación; boostear un modelo de prueba, confirmar que
   aparece primero en `GET /api/models`.

## Open questions parked

- **Precios de `TOKEN_PACK` y `top_services`**: los de este documento vienen
  del plan original pegado en el chat, no fueron re-confirmados número por
  número — validar antes de sembrar en prod.
- Boost a nivel de imagen individual y "Banner premium" / "Categoría
  destacada" — catálogo `top_services` queda listo para agregarlos, pero
  requieren decidir *dónde* se renderizan en illidan (no hay banner/categoría
  en el diseño actual de la vitrina).
- Bonificación de tokens al comprar plan anual — mencionada en el plan
  original ("Bonificación inicial de tokens"), no incluida en este MVP.
- Refresh en vivo del saldo del wallet tras comprar/boostear sin recargar la
  página — se resuelve con el mismo patrón de `useSubscription`/`refetch` ya
  usado por `SubscriptionProvider`, detallar en el plan de implementación.
