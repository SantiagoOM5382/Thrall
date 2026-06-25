# Sylvanas — Plan de Implementación Frontend

**Fecha:** 2026-06-23  
**Estado:** Aprobado  
**Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui  
**Auth:** JWT httpOnly cookie `arthas_token` (24h), middleware Edge para proteger rutas  
**Data fetching:** Server Components para lecturas; Server Actions para mutaciones  
**Forms:** react-hook-form + zod  
**JWT Edge:** `jose` (compatible con Edge Runtime)  

---

## Global Constraints

- **Next.js 15 App Router** con TypeScript strict. Cero `any` implícitos.
- **Tailwind + shadcn/ui** para toda la UI. No mezclar otras librerías de componentes.
- **httpOnly cookie** `arthas_token` para el JWT. El JS del cliente nunca toca el token.
- **`THRALL_URL`** (env privada, server-side) apunta al backend thrall.
- **`JWT_SECRET`** (env privada) — la misma que usa thrall — para verificar el token en middleware.
- **Middleware de Next.js** protege todas las rutas `/dashboard/*` y `/login` redirige si ya hay sesión.
- **SessionProvider** (Client Component) recibe el payload JWT del Server Component del layout y lo expone vía Context. El cliente nunca decodifica el cookie directamente.
- **Formatos:**
  - Moneda: `new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)`
  - Fechas/horas: `America/Bogota` timezone en todos los displays (`Intl.DateTimeFormat` con `timeZone: 'America/Bogota'`)
- **Soft delete visual:** servicios con `deleted_at !== null` se muestran con fondo rojo suave y badge "Eliminado". Solo admin los ve.
- **Ganancias no persistidas:** siempre calculadas en el cliente desde `base_price` y extras que devuelve la API.
- **Landing pública:** SSR con `revalidate: 3600`. Perfiles de modelos: SSG con `generateStaticParams`.
- **Redirecciones post-login:** admin/monitor → `/dashboard/services`, model → `/dashboard/profile`.
- **CORS thrall:** configurar `ALLOWED_ORIGIN` en thrall para aceptar el dominio de sylvanas.
- **No tests de componentes en el piloto.** Solo tests unitarios para utilidades puras (`formatCOP`, `formatDuration`, `calcEarnings` display).
- **Carpeta del proyecto:** `sylvanas/` en la raíz del monorepo arthas.

---

## Variables de Entorno

```env
# sylvanas/.env.local.example
THRALL_URL=http://localhost:3001          # URL interna de thrall (privada)
JWT_SECRET=mismo-secreto-que-thrall      # Para verificar tokens en middleware
NEXT_PUBLIC_APP_NAME=Arthas              # Nombre de la app (público)
```

---

## Estructura de Archivos

```
sylvanas/
├── app/
│   ├── layout.tsx                      root layout (fuentes, metadata)
│   ├── page.tsx                        landing pública (SSR)
│   ├── login/
│   │   └── page.tsx
│   ├── models/
│   │   └── [id]/
│   │       └── page.tsx                perfil público (SSG)
│   └── dashboard/
│       ├── layout.tsx                  auth guard + SessionProvider + Sidebar
│       ├── page.tsx                    redirect por rol
│       ├── services/
│       │   ├── page.tsx
│       │   └── new/
│       │       └── page.tsx
│       ├── earnings/
│       │   └── page.tsx
│       ├── model-earnings/
│       │   └── page.tsx
│       ├── models/
│       │   ├── page.tsx
│       │   └── [id]/
│       │       └── page.tsx
│       ├── pay-methods/
│       │   └── page.tsx
│       ├── profile/
│       │   └── page.tsx
│       └── ranking/
│           └── page.tsx
├── components/
│   ├── ui/                             shadcn (auto-generado)
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   ├── session-provider.tsx            Client Component, React Context
│   └── shared/
│       ├── currency-display.tsx
│       ├── service-card.tsx
│       └── model-avatar.tsx
├── lib/
│   ├── api.ts                          fetch wrapper server-side (lee cookie)
│   ├── auth.ts                         server actions: login, logout
│   ├── session.ts                      getSession() helper para Server Components
│   └── utils.ts                        formatCOP, formatDuration, formatBogotaDate
├── hooks/
│   └── use-session.ts                  useSession() hook cliente (lee Context)
├── middleware.ts                       Edge: verifica cookie, guarda rutas
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Tasks

### Task 1 — Scaffolding del proyecto

**Objetivo:** Crear la base del proyecto `sylvanas/` con todas las dependencias y configuración.

**Pasos:**

1. Dentro de `arthas/`, crear `sylvanas/` con create-next-app:
   ```bash
   npx create-next-app@latest sylvanas \
     --typescript --tailwind --app --src-dir no \
     --import-alias "@/*" --use-npm
   ```
2. Instalar dependencias:
   ```bash
   cd sylvanas
   npm install jose react-hook-form @hookform/resolvers zod
   npm install -D @types/node
   ```
3. Inicializar shadcn/ui:
   ```bash
   npx shadcn@latest init
   ```
   Configuración: New York style, slate color, CSS variables: yes.
4. Instalar componentes shadcn necesarios:
   ```bash
   npx shadcn@latest add button input label card table badge dialog select textarea toast
   ```
5. Crear `sylvanas/.env.local.example` con las variables de entorno documentadas.
6. Crear `sylvanas/.gitignore` (ignorar `.env.local`, `.next/`, `node_modules/`).
7. Crear `sylvanas/lib/utils.ts` con:
   - `formatCOP(n: number): string` — formatea como COP
   - `formatDuration(startMs: number, endMs: number): string` — "2h 30m"
   - `formatBogotaDate(ms: number, opts?: Intl.DateTimeFormatOptions): string` — fecha en Bogotá
   - `calcEarnings(basePrice: number, extras: number[]): { modelBase, company, modelExtras, modelTotal }`
8. Tests unitarios para las 4 utilidades en `sylvanas/tests/utils.test.ts` con Vitest.
9. Configurar Vitest: `sylvanas/vitest.config.ts` (environment: 'node', globals: true).
10. `npm test` debe pasar con las utilidades cubiertas.
11. Commit: `feat: sylvanas project scaffolding`

**Criterios de aceptación:**
- `npx tsc --noEmit` sin errores
- `npm test` pasa (utilidades testeadas)
- shadcn/ui operativo (Button importable desde `@/components/ui/button`)
- `.env.local.example` documenta todas las variables

---

### Task 2 — Auth infrastructure

**Objetivo:** Cookie httpOnly, Server Actions de login/logout, middleware Edge, login page, SessionProvider.

**Archivos a crear:**

**`sylvanas/lib/session.ts`**
```ts
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

export interface SessionUser {
  sub: string
  role: 'admin' | 'monitor' | 'model'
  brandId: string
  name: string
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get('arthas_token')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}
```

**`sylvanas/lib/auth.ts`** — Server Actions:
```ts
'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(email: string, password: string): Promise<{ error?: string }> {
  const res = await fetch(`${process.env.THRALL_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error ?? 'Credenciales inválidas' }
  }
  const { token, user } = await res.json()
  ;(await cookies()).set('arthas_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24h
    path: '/',
  })
  redirect(user.role === 'model' ? '/dashboard/profile' : '/dashboard/services')
}

export async function logout() {
  ;(await cookies()).delete('arthas_token')
  redirect('/login')
}
```

**`sylvanas/lib/api.ts`** — fetch wrapper server-side:
```ts
import { cookies } from 'next/headers'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = (await cookies()).get('arthas_token')?.value
  const res = await fetch(`${process.env.THRALL_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    cache: options?.cache ?? 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}
```

**`sylvanas/middleware.ts`** — Edge Runtime:
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/', '/login', '/models']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('arthas_token')?.value
  const isDashboard = pathname.startsWith('/dashboard')
  const isLogin = pathname === '/login'

  if (isDashboard) {
    if (!token) return NextResponse.redirect(new URL('/login', request.url))
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
      await jwtVerify(token, secret)
    } catch {
      const res = NextResponse.redirect(new URL('/login', request.url))
      res.cookies.delete('arthas_token')
      return res
    }
  }

  if (isLogin && token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
      await jwtVerify(token, secret)
      return NextResponse.redirect(new URL('/dashboard/services', request.url))
    } catch {
      // invalid token, let them through to login
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
```

**`sylvanas/components/session-provider.tsx`**:
```tsx
'use client'
import { createContext, useContext } from 'react'
import type { SessionUser } from '@/lib/session'

const SessionContext = createContext<SessionUser | null>(null)

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
}

export function useSession(): SessionUser {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
```

**`sylvanas/app/login/page.tsx`** — Login form (Client Component con react-hook-form):
- Email + password fields
- Llama `login()` Server Action al submit
- Muestra error si falla
- Loading state en el botón

**Criterios de aceptación:**
- Login exitoso setea cookie y redirige por rol
- Login fallido muestra el error de la API
- Acceso a `/dashboard/*` sin cookie redirige a `/login`
- Cookie con flag `httpOnly: true, secure: true` en producción
- Token expirado o inválido → redirige a `/login` y borra cookie
- `npx tsc --noEmit` sin errores

---

### Task 3 — Landing pública + perfiles de modelos

**Objetivo:** Landing page SSR con galería de modelos activas y perfiles individuales SSG.

**`sylvanas/app/page.tsx`** (Server Component):
- `export const revalidate = 3600`
- Llama `GET /models` sin auth (público)
- Grid responsivo de tarjetas: foto principal (`user_images[0]`), nombre, descripción truncada
- Botones: WhatsApp (`https://wa.me/${phone}`) y Telegram (`https://t.me/${telegram}`) si existen
- Si no hay modelos activas, mensaje vacío amigable
- Link a `/models/[id]` en cada tarjeta

**`sylvanas/app/models/[id]/page.tsx`** (Server Component):
- `generateStaticParams`: llama `GET /models`, retorna ids de modelos activas
- `export const revalidate = 3600`
- Llama `GET /models/:id`
- Galería de fotos ordenadas por `sort_order ASC`
- Nombre, descripción, teléfono, telegram
- Si modelo no encontrada → `notFound()`
- Botón "Volver" a `/`

**Shared component `sylvanas/components/shared/model-avatar.tsx`**:
- Muestra primera imagen o placeholder con iniciales del nombre
- Props: `url?: string, name: string, size?: 'sm' | 'md' | 'lg'`

**Criterios de aceptación:**
- Landing renderiza en el servidor (sin hydration errors)
- `revalidate: 3600` configurado
- `generateStaticParams` implementado en perfil individual
- Links de contacto solo aparecen si el campo existe
- `notFound()` en perfil si modelo no existe
- `npx tsc --noEmit` sin errores

---

### Task 4 — Dashboard shell (layout + sidebar + redirect)

**Objetivo:** Layout del dashboard con auth guard, SessionProvider, navegación por rol, y redirect inicial.

**`sylvanas/app/dashboard/layout.tsx`** (Server Component):
```tsx
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { SessionProvider } from '@/components/session-provider'
import Sidebar from '@/components/layout/sidebar'

export default async function DashboardLayout({ children }) {
  const user = await getSession()
  if (!user) redirect('/login')
  return (
    <SessionProvider user={user}>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </SessionProvider>
  )
}
```

**`sylvanas/app/dashboard/page.tsx`** (Server Component):
- Lee sesión, redirige: admin/monitor → `/dashboard/services`, model → `/dashboard/profile`

**`sylvanas/components/layout/sidebar.tsx`** (Client Component — necesita `useSession`):
- Nombre del usuario en la parte superior
- Badge con rol (admin/monitor/model)
- Navegación por rol:
  - **Admin:** Servicios, Ganancias empresa, Ganancias por modelo, Modelos, Métodos de pago, Ranking
  - **Monitor:** Servicios, Ranking
  - **Model:** Mi perfil, Ranking
- Botón "Cerrar sesión" que llama `logout()` Server Action
- Marca el link activo con `usePathname()`

**`sylvanas/components/layout/header.tsx`** (opcional): título de la página actual

**Criterios de aceptación:**
- Sin cookie válida, `/dashboard/services` redirige a `/login` (middleware)
- Sidebar muestra solo las rutas del rol del usuario
- Link activo visualmente marcado
- Logout borra cookie y redirige a `/login`
- SessionProvider provee user a todos los Client Components del dashboard
- `npx tsc --noEmit` sin errores

---

### Task 5 — Servicios del día + formulario nuevo servicio

**Objetivo:** Página de servicios del día (admin/monitor) y formulario de creación.

**`sylvanas/app/dashboard/services/page.tsx`** (Server Component):
- Llama `GET /api/services` (filtrado por rol en thrall — admin ve todo+eliminados, monitor ve solo hoy activos)
- Tabla con columnas: hora inicio, hora fin, modelo, precio base, extras, total modelo, método de pago (code), nota, estado
- Horas en formato `HH:mm` timezone Bogotá con `formatBogotaDate`
- Precio base y totales con `formatCOP`
- Duración calculada con `formatDuration`
- Extras: lista compacta `descripción ($monto)` o badge con count
- Estado: servicios eliminados (`deleted_at !== null`) con fondo rojo y badge "Eliminado" (solo admin los ve así)
- Acciones por fila: Eliminar (admin+monitor, solo activos) — llama Server Action `deleteService(id)`
- Botón "Nuevo servicio" → `/dashboard/services/new`
- Si no hay servicios hoy, mensaje vacío amigable

**Server Actions en `sylvanas/app/dashboard/services/actions.ts`**:
```ts
'use server'
import { apiFetch } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export async function deleteService(id: string) {
  await apiFetch(`/services/${id}`, { method: 'DELETE' })
  revalidatePath('/dashboard/services')
}

export async function createService(data: CreateServiceInput) {
  await apiFetch('/services', { method: 'POST', body: JSON.stringify(data) })
  revalidatePath('/dashboard/services')
  redirect('/dashboard/services')
}
```

**`sylvanas/app/dashboard/services/new/page.tsx`** (Server Component + Client Form):
- Server Component: obtiene lista de modelos activas (`GET /models`) y métodos de pago (`GET /pay-methods`)
- Pasa datos al Client Form como props
- Client Form con react-hook-form + zod:
  - Selector de modelo (nombre)
  - Hora inicio (datetime-local)
  - Hora fin (datetime-local) — validación `endTime > startTime`
  - Precio base (número entero)
  - Selector de método de pago (muestra solo `code` para monitor, `code + displayName` para admin)
  - Nota (textarea, opcional)
  - Sección de extras: lista dinámica de pares `descripción + monto` con botón "Agregar extra"
  - Preview de ganancias calculadas en tiempo real (modelo base, extras, total modelo, empresa)
  - Submit llama `createService()` Server Action

**Criterios de aceptación:**
- Tabla de servicios renderiza correctamente con datos reales
- Soft-deleted aparecen con estilo visual diferenciado (solo para admin)
- Extras se muestran correctamente
- Formulario valida localmente antes de enviar
- Preview de ganancias actualiza en tiempo real
- `deleteService` llama a thrall y hace `revalidatePath`
- `createService` redirige a lista tras éxito
- Errores de API se muestran al usuario con toast
- `npx tsc --noEmit` sin errores

---

### Task 6 — Páginas de ganancias (admin)

**Objetivo:** Panel de ganancias empresa y ganancias por modelo con filtros de fecha.

**Shared component `sylvanas/components/shared/date-range-picker.tsx`** (Client Component):
- Dos inputs `type="date"` (desde/hasta)
- Al cambiar, actualiza URL params con `useRouter` + `router.push`
- Valor inicial desde `searchParams`

**`sylvanas/app/dashboard/earnings/page.tsx`** (Server Component):
- Lee `searchParams.from` y `searchParams.to` (fechas en formato `YYYY-MM-DD`)
- Convierte a timestamps Unix ms en Bogotá (inicio del día from, fin del día to)
- Llama `GET /api/reports/earnings?from=&to=`
- Muestra:
  - Total servicios en el período
  - Suma total base_price (formatCOP)
  - Ganancia empresa = 40% base total (formatCOP)
  - Ganancia modelos = 60% base + todos los extras (formatCOP)
  - Tabla desglose por método de pago: code, cantidad, suma base, ganancia empresa
- DateRangePicker para cambiar período
- Si no hay datos, mensaje vacío

**`sylvanas/app/dashboard/model-earnings/page.tsx`** (Server Component):
- `searchParams`: `modelId`, `from`, `to`
- Selector de modelo: lista de usuarios con role='model' (`GET /api/users?role=model` — admin only)
- Llama `GET /api/reports/model-earnings/:id?from=&to=`
- Tabla por servicio: fecha, duración, precio base, extras (lista), ganancia modelo
- Fila de totales al pie
- DateRangePicker
- Si no se seleccionó modelo, mensaje de instrucción

**Criterios de aceptación:**
- Filtros de fecha actualizan la URL y refrescan datos
- Ganancias mostradas correctamente con `formatCOP`
- Desglose por método de pago en earnings
- Tabla de servicios por modelo con totales
- Manejo de período sin datos
- Solo admin puede acceder (middleware ya protege; thrall retorna 403 si no es admin)
- `npx tsc --noEmit` sin errores

---

### Task 7 — Gestión de modelos y métodos de pago (admin)

**Objetivo:** Páginas de administración de modelos (con imágenes) y métodos de pago.

**`sylvanas/app/dashboard/models/page.tsx`** (Server Component):
- Llama `GET /api/users` (admin only — thrall devuelve todos los roles)
- Filtra/muestra solo usuarios con `role === 'model'`
- Tabla: nombre, email, teléfono, telegram, estado (activo/inactivo/eliminado)
- Soft-deleted con estilo visual diferenciado
- Link a detalle: `/dashboard/models/[id]`

**`sylvanas/app/dashboard/models/[id]/page.tsx`** (Server Component):
- `GET /api/users/:id` — datos del modelo
- `GET /api/models/:id` — imágenes ordenadas por sort_order
- Muestra info del modelo: nombre, email, descripción, teléfono, telegram
- Galería de imágenes con sort_order visible
- Botón "Subir imagen": abre dialog con input file
  - Client Component que hace `POST /api/images/users/:id` (multipart)
  - Nota: Vercel Blob upload se hace directamente en thrall, el form submits a Server Action que llama thrall
- Botón eliminar imagen por cada foto (llama `DELETE /api/images/:id`)
- Server Actions en `actions.ts`:
  - `uploadImage(userId: string, formData: FormData)` — llama thrall POST multipart
  - `deleteImage(imageId: string)` — llama thrall DELETE, revalidatePath
- Si modelo no existe → `notFound()`

**`sylvanas/app/dashboard/pay-methods/page.tsx`** (Server Component + Client interactions):
- `GET /api/pay-methods` — lista todos (admin ve display_name)
- Tabla: code, display_name, estado activo/inactivo/eliminado
- Botón "Nuevo método de pago": dialog con form (code, display_name)
- Botón editar por fila: dialog con form pre-poblado
- Botón eliminar por fila: confirmación → soft delete
- Server Actions:
  - `createPayMethod(data)`, `updatePayMethod(id, data)`, `deletePayMethod(id)`
  - Cada uno hace `revalidatePath('/dashboard/pay-methods')`
- Formularios con react-hook-form + zod

**Criterios de aceptación:**
- Lista de modelos muestra estado visual correcto
- Detalle de modelo muestra imágenes ordenadas
- Upload de imagen funciona y actualiza la galería
- CRUD de pay-methods con dialogs
- Errores de API se muestran al usuario
- `npx tsc --noEmit` sin errores

---

### Task 8 — Perfil modelo + Ranking

**Objetivo:** Página de perfil para la model (sus servicios hoy + fotos) y ranking para todos.

**`sylvanas/app/dashboard/profile/page.tsx`** (Server Component):
- `getSession()` para obtener `user.sub`
- `GET /api/services` — thrall filtra solo los servicios propios de hoy del modelo
- `GET /api/models/:id` — imágenes del modelo
- Sección servicios de hoy:
  - Tabla: hora inicio, hora fin, duración, precio base, extras, ganancia modelo
  - `formatCOP` para montos, `formatBogotaDate` para horas
  - Si no hay servicios hoy, mensaje amigable
- Sección galería de fotos:
  - Muestra fotos del modelo ordenadas por sort_order
  - Botón "Subir foto": input file, llama Server Action `uploadImage(userId, formData)`
  - Sin botón de eliminar (modelo no puede eliminar)
- Resumen de ganancias del día al final: total model base + extras = total

**`sylvanas/app/dashboard/ranking/page.tsx`** (Server Component):
- `GET /api/reports/ranking`
- Tabla: posición, nombre, cantidad de servicios, ingresos totales generados (formatCOP)
- Top 3 con destacado visual (gold, silver, bronze)
- Disponible para todos los roles autenticados

**Criterios de aceptación:**
- Profile muestra solo los servicios de hoy del modelo autenticado
- Foto upload funciona para el modelo
- Ranking muestra la tabla completa con top 3 destacado
- Totales de ganancias del día calculados correctamente en el cliente
- `npx tsc --noEmit` sin errores
- Commit: `feat: model profile page and ranking`

---

## Resumen de Tasks

| # | Nombre | Archivos principales |
|---|--------|---------------------|
| 1 | Scaffolding | package.json, tsconfig, vitest, lib/utils.ts, tests/ |
| 2 | Auth infrastructure | lib/session.ts, lib/auth.ts, lib/api.ts, middleware.ts, session-provider.tsx, app/login/ |
| 3 | Landing + perfiles públicos | app/page.tsx, app/models/[id]/page.tsx, components/shared/model-avatar.tsx |
| 4 | Dashboard shell | app/dashboard/layout.tsx, app/dashboard/page.tsx, components/layout/sidebar.tsx |
| 5 | Servicios | app/dashboard/services/, app/dashboard/services/new/, actions.ts |
| 6 | Ganancias | app/dashboard/earnings/, app/dashboard/model-earnings/, date-range-picker.tsx |
| 7 | Modelos + pay-methods | app/dashboard/models/, app/dashboard/pay-methods/ |
| 8 | Perfil + Ranking | app/dashboard/profile/, app/dashboard/ranking/ |
