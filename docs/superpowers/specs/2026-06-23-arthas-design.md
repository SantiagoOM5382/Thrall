# Arthas — Diseño del Sistema

**Fecha:** 2026-06-23  
**Estado:** Aprobado  
**Proyectos:** `illidan` (reservado), `thrall` (backend), `sylvanas` (frontend)

---

## 1. Visión General

Sistema de gestión contable para una empresa de modelos. Permite registrar servicios, calcular ganancias por modelo y empresa, gestionar imágenes públicas de modelos, y exponer una landing page pública con perfiles de modelos.

Diseñado para un piloto con una sola brand. La arquitectura soporta multitenancy a futuro sin refactors mayores.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Hosting |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Vercel |
| Backend | Hono.js (Vercel Functions) | Vercel |
| ORM | Drizzle ORM | — |
| Base de datos | Turso (LibSQL) | Turso free tier |
| Almacenamiento de imágenes | Vercel Blob | Vercel |
| Auth | JWT (HS256, 24h, stateless) | — |

`thrall` es un proyecto Vercel independiente que expone `/api/*`. `sylvanas` lo consume via HTTP. Comparten el mismo Turso DB y Vercel Blob bucket.

`illidan` está reservado como carpeta — a futuro puede extraerse el módulo de auth si se necesita escalar.

---

## 3. Base de Datos

> **Convención:** IDs como `TEXT` (ULID). Precios como `INTEGER` (pesos colombianos, sin decimales). Timestamps como `INTEGER` (unix ms). Soft delete via `deleted_at INTEGER NULL`.

### `brands`
```
id          TEXT PK
name        TEXT
is_active   INTEGER DEFAULT 1
created_at  INTEGER
updated_at  INTEGER
```

### `users`
```
id          TEXT PK
brand_id    TEXT FK → brands.id
name        TEXT
email       TEXT UNIQUE
password    TEXT (bcrypt)
role        TEXT CHECK('admin','monitor','model')
phone       TEXT NULL
telegram    TEXT NULL
description TEXT NULL
is_active   INTEGER DEFAULT 1
created_at  INTEGER
updated_at  INTEGER
deleted_at  INTEGER NULL
```

### `user_images`
```
id          TEXT PK
user_id     TEXT FK → users.id
url         TEXT (Vercel Blob URL)
sort_order  INTEGER DEFAULT 0   -- base para sistema de boost futuro
is_active   INTEGER DEFAULT 1
created_at  INTEGER
updated_at  INTEGER
deleted_at  INTEGER NULL
```

### `pay_methods`
```
id           TEXT PK
code         TEXT UNIQUE (NQST | NQCA | BCST | BCLS | DP | DVCA)
display_name TEXT
is_active    INTEGER DEFAULT 1
created_at   INTEGER
updated_at   INTEGER
deleted_at   INTEGER NULL
```

### `services`
```
id             TEXT PK
model_id       TEXT FK → users.id
created_by     TEXT FK → users.id  -- monitor o admin que lo registró
start_time     INTEGER (unix ms)
end_time       INTEGER (unix ms)
base_price     INTEGER
pay_method_id  TEXT FK → pay_methods.id
note           TEXT NULL
created_at     INTEGER
updated_at     INTEGER
deleted_at     INTEGER NULL         -- soft delete; admin ve estado 'eliminado'
```

### `service_extras`
```
id          TEXT PK
service_id  TEXT FK → services.id
description TEXT
amount      INTEGER
created_at  INTEGER
```

### `audit_logs`
```
id          TEXT PK
user_id     TEXT FK → users.id
action      TEXT (CREATE | UPDATE | DELETE)
entity      TEXT (service | user | image | pay_method)
entity_id   TEXT
metadata    TEXT (JSON string)
created_at  INTEGER
```

### `brand_subscriptions`
```
id          TEXT PK
brand_id    TEXT FK → brands.id
plan        TEXT DEFAULT 'pilot'
is_active   INTEGER DEFAULT 1
paid_until  INTEGER NULL
created_at  INTEGER
updated_at  INTEGER
```
> Semilla: 1 registro activo para la brand del piloto. Base para el modelo SaaS futuro donde brands pagan para acceder.

---

## 4. Lógica de Negocio

### Ganancias (nunca persistidas, siempre calculadas)

```
ganancia_modelo_base  = base_price × 0.6
ganancia_empresa      = base_price × 0.4
ganancia_modelo_extra = SUM(service_extras.amount)   -- 100% de la modelo
ganancia_modelo_total = ganancia_modelo_base + ganancia_modelo_extra
```

### Timezone

Toda lógica de "hoy" y "día en curso" se calcula server-side en `America/Bogota` (UTC−5). El cliente nunca envía rangos de fechas para "hoy".

### Soft delete en `services`

- Monitor: ve solo servicios activos (`deleted_at IS NULL`). Puede marcar un servicio como eliminado.
- Admin: ve todos los servicios incluyendo los eliminados, con indicador de estado.

---

## 5. Auth

- `POST /api/auth/login` → valida email + password → retorna JWT (24h)
- `GET /api/auth/me` → datos del usuario autenticado
- Payload JWT: `{ sub: userId, role, brandId, name, iat, exp }`
- Middleware de Hono valida JWT antes de cada handler protegido
- Sin refresh tokens en el piloto — re-login al vencer las 24h

---

## 6. Permisos

|           Recurso                  | Admin | Monitor | Model |
|------------------------------------|-------|---------|-------|
| Crear / editar / eliminar usuarios | ✅   | ❌     | ❌    |
| Ver lista de usuarios | ✅ | ❌ | ❌ |
| Gestionar métodos de pago (CRUD) | ✅ | ❌ | ❌ |
| Ver `display_name` de pay_methods | ✅ | ❌ (solo `code`) | ❌ (solo `code`) |
| Ver imágenes de modelos | ✅ | ✅ | solo las propias |
| Subir imágenes | ✅ | ✅ (cualquier modelo) | solo las propias |
| Eliminar / desactivar imágenes | ✅ | ✅ | ❌ |
| Ver servicios | ✅ todos + eliminados | ✅ solo hoy (activos) | solo propios de hoy |
| Crear servicios | ✅ | ✅ | ❌ |
| Editar / eliminar servicios | ✅ | ✅ (soft delete) | ❌ |
| Panel ganancias empresa | ✅ | ❌ | ❌ |
| Panel ganancias por modelo | ✅ | ❌ | ❌ |
| Panel servicios del día | ✅ | ✅ | ❌ |
| Ranking | ✅ | ✅ | ✅ |

> `display_name` se omite en la capa de serialización central cuando `role !== 'admin'`. No es un `if` por endpoint.

---

## 7. API — `thrall`

```
/api/
├── auth/
│   ├── POST   /login
│   └── GET    /me
│
├── users/                          [admin]
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /:id
│   ├── PUT    /:id
│   └── DELETE /:id                 soft delete
│
├── models/                         [público]
│   ├── GET    /                    para landing page
│   └── GET    /:id
│
├── images/
│   ├── POST   /users/:id           sube a Vercel Blob [admin, monitor, model=self]
│   └── DELETE /:id                 soft delete [admin, monitor]
│
├── services/
│   ├── GET    /                    filtrado por rol + timezone Bogotá
│   ├── POST   /                    [admin, monitor]
│   ├── PUT    /:id                 [admin, monitor]
│   └── DELETE /:id                 soft delete [admin, monitor]
│
├── pay-methods/
│   ├── GET    /                    [autenticado]
│   ├── POST   /                    [admin]
│   ├── PUT    /:id                 [admin]
│   └── DELETE /:id                 soft delete [admin]
│
└── reports/
    ├── GET    /earnings            [admin] ?from=&to=
    ├── GET    /model-earnings/:id  [admin] ?from=&to=
    ├── GET    /daily               [admin, monitor]
    └── GET    /ranking             [todos]
```

---

## 8. Frontend — `sylvanas`

### Rutas

```
app/
├── page.tsx                        landing pública — galería de modelos
├── models/[id]/page.tsx            perfil público individual
│
└── dashboard/
    ├── layout.tsx                  guard de auth
    ├── page.tsx                    redirige por rol
    │
    ├── services/
    │   ├── page.tsx                [admin, monitor] servicios del día
    │   └── new/page.tsx            [admin, monitor] crear servicio
    │
    ├── earnings/
    │   └── page.tsx                [admin] ganancias empresa
    │
    ├── model-earnings/
    │   └── page.tsx                [admin] ganancias por modelo
    │
    ├── models/
    │   ├── page.tsx                [admin] gestión de modelos
    │   └── [id]/page.tsx           [admin] detalle + imágenes
    │
    ├── pay-methods/
    │   └── page.tsx                [admin] gestión de métodos de pago
    │
    ├── profile/
    │   └── page.tsx                [model] servicios de hoy + subir fotos
    │
    └── ranking/
        └── page.tsx                [todos] leaderboard
```

### Redirecciones post-login

| Rol | Destino |
|---|---|
| admin | `/dashboard/services` |
| monitor | `/dashboard/services` |
| model | `/dashboard/profile` |

### Landing pública

- SSR con revalidación cada hora
- Grid de modelos activas ordenadas por `sort_order ASC`
- Nombre, descripción, botones de contacto (WhatsApp desde `phone`, Telegram desde `telegram`)
- `generateStaticParams` para perfiles individuales

### Paneles del dashboard

**Servicios del día** (admin + monitor)
- Lista: hora inicio/fin, modelo, precio base, extras, método de pago (`code`), nota, estado
- Formulario de nuevo servicio: modelo (select), inicio, fin, precio base, pay_method, nota, extras (N campos dinámicos: descripción + monto)
- Admin ve registros eliminados con indicador visual

**Ganancias empresa** (admin)
- Filtro: fecha inicio → fecha fin
- Totales: cantidad servicios, suma base_price, ganancia empresa (40%), ganancia modelos (60%+extras)
- Desglose por método de pago

**Ganancias por modelo** (admin)
- Selector de modelo + filtro de fechas
- Tabla por servicio: fecha, duración, precio base, extras, ganancia modelo
- Fila de totales al pie

**Perfil modelo** (model)
- Servicios de hoy: hora, duración, precio base, extras, su ganancia
- Galería de sus fotos + botón subir (sin eliminar)

**Ranking** (todos)
- Top modelos por cantidad de servicios
- Columnas: posición, nombre, cantidad de servicios, ingresos totales generados

---

## 9. Monetización Futura

### Brand subscriptions (SaaS)
- `brand_subscriptions` ya está en el schema
- Middleware chequea `is_active` y `paid_until` antes del login
- Brands inactivas reciben `403` con mensaje de suscripción vencida

### Sistema de tokens para imágenes destacadas (en diseño)
- `sort_order` ya existe en `user_images` como base
- Propuesta futura: `brand_token_balance` + `image_boost` (service_id, starts_at, ends_at, tokens_spent)
- Algoritmo de feed: boosted primero (ORDER BY is_boosted DESC, sort_order ASC)

---

## 10. Decisiones de Diseño

| Decisión | Razón |
|---|---|
| Un solo backend `thrall` | Evita complejidad de microservicios en piloto free-tier |
| Precios como INTEGER | SQLite/Turso no tiene DECIMAL; evita errores de float |
| IDs como ULID | Ordenables por tiempo, sin colisiones, compatibles con SQLite TEXT |
| Soft delete en services | Admin necesita historial completo incluyendo eliminados |
| Timezone server-side | Evita bugs de "día equivocado" por diferencias cliente/servidor |
| display_name solo admin | Control centralizado en serializer, no por endpoint |
| Ganancias calculadas | Si cambian los % en el futuro, los datos históricos no se rompen |
