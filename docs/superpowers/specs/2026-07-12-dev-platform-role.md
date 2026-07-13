# Arthas — Rol Dev (plataforma) — Fase 1

**Fecha:** 2026-07-12
**Estado:** Aprobado
**Proyectos afectados:** `thrall` (backend), `sylvanas` (frontend)
**Depende de:** [2026-06-23-arthas-design.md](2026-06-23-arthas-design.md)
**Fase 2 (futura, fuera de este spec):** entrar a cualquier brand en modo lectura.

---

## 1. Motivación

Falta un rol por encima de admin que gestione la plataforma multi-brand: crear
brands, crear admins y vincularlos a una brand, y ver ingresos por brand. Este
spec cubre la **Fase 1** (supervisor de plataforma). El Dev NO hace operación
diaria (servicios, multas, pagos) — eso lo hace el admin/monitor de cada brand.

## 2. Rol y auth (thrall)

- Nuevo valor `dev` en el enum de rol de `users` (migración).
- El Dev no está atado a una brand operativa. Como `users.brand_id` es NOT NULL
  (FK a `brands`), se siembra una brand **"Plataforma"** y el Dev seed se asigna
  a ella. El RBAC trata al Dev como **cross-brand**: no filtra por su `brandId`.
- El JWT del Dev lleva `role: 'dev'` (mismo payload `{ sub, role, brandId, name }`).
- **Bootstrap:** el script de seed crea la brand "Plataforma" + un usuario Dev
  (ej. `dev@arthas.co` / contraseña de seed). No se crean Devs desde la UI.

## 3. Endpoints nuevos (thrall)

Todos `requireRole('dev')` salvo donde se indique.

```
Brands
  GET    /api/brands              → todas las brands (id, name, isActive, createdAt)
  POST   /api/brands              body { name }  → crea brand activa + brand_subscription plan 'pilot'
  PUT    /api/brands/:id          body { name?, isActive? }  → edita; 404 si no existe

Usuarios (extensión de la ruta existente)
  POST   /api/users              caller dev: body incluye brandId (destino) + role (admin);
                                 caller admin: se sigue forzando caller.brandId (comportamiento actual).
  GET    /api/users              caller dev: devuelve todos los usuarios; ?brandId= filtra por brand.
                                 caller admin: sigue devolviendo solo su brand (actual).

Reportes
  GET    /api/reports/brand-earnings?from=&to=   [dev]
         → { rows: [{ brandId, brandName, totalServices, totalBase, companyEarnings, modelTotalEarnings }],
             totals: { totalServices, totalBase, companyEarnings, modelTotalEarnings } }
```

- `brand-earnings` calcula por brand, sumando sobre los servicios activos de las
  modelos de esa brand en el rango: `companyEarnings = 40% base`,
  `modelTotalEarnings = 60% base + extras` (reusar `calcEarnings`). El rango
  `from/to` son unix ms (día completo Bogotá), igual que `/reports/earnings`.
- Validación: `name` no vacío (brands); para `POST /users` de dev, `brandId`
  debe existir y `role` válido.
- Rebuild del bundle `dist/index.mjs` tras el cambio de `src`.

## 4. Frontend (sylvanas)

- El tipo `Role` incluye `dev`. `SessionUser.role` puede ser `dev`.
- **Sidebar del Dev** (solo estos ítems; nada de la operación):
  - **Brands** → `/dashboard/brands`
  - **Ingresos por brand** → `/dashboard/brand-earnings`
- **Redirección post-login:** `dev` → `/dashboard/brands`. (admin/monitor →
  services, model → profile, sin cambios.)
- **`/dashboard/brands`** (dev):
  - Lista de brands (nombre, estado activo/inactivo, fecha).
  - **Crear brand** (nombre) y **editar** (nombre, activo) por diálogo.
  - Por cada brand, mostrar sus **admins** (de `GET /users?brandId=`), y un botón
    **"Nuevo admin"** que abre un diálogo (elige brand + nombre, correo, contraseña).
- **`/dashboard/brand-earnings`** (dev):
  - `DateRangePicker` (default: primer día del mes actual → hoy, Bogotá).
  - Tabla: una fila por brand con nombre, # servicios, base total, ganancia
    empresa, ganancia modelos; fila de **totales** al pie.

## 5. Permisos (resumen)

| Acción | Dev | Admin | Monitor | Model |
|---|---|---|---|---|
| Crear/editar/listar brands | ✅ | ❌ | ❌ | ❌ |
| Crear admin en cualquier brand | ✅ | ❌ | ❌ | ❌ |
| Crear usuarios en su propia brand | — | ✅ | ❌ | ❌ |
| Ver ingresos por brand (cross-brand) | ✅ | ❌ | ❌ | ❌ |
| Operación diaria (servicios/pagos/etc.) | ❌ | ✅ | parcial | ❌ |

## 6. Fuera de alcance (Fase 2 / futuro)

- Entrar a una brand en modo **solo lectura** (modelos, servicios, ganancias por modelo).
- Crear otros **Devs** desde la UI (por ahora solo seed).
- Editar/eliminar admins por el Dev (Fase 1 solo crea y lista).
- Gestión de suscripciones/planes de brand más allá del 'pilot' automático.

## 7. Decisiones

| Decisión | Razón |
|---|---|
| Brand "Plataforma" para el Dev | `users.brand_id` es NOT NULL; evita migración invasiva para hacerlo nullable |
| Dev cross-brand vía RBAC (no por brandId) | El Dev supervisa todas las brands, no una |
| POST /users acepta brandId solo para dev | Admin sigue forzando su brand (multi-tenant seguro); dev elige destino |
| Fase 2 aparte (drill-down lectura) | Multiplica el trabajo en casi todos los endpoints de datos; se aísla |
