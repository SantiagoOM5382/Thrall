# Earnings Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate model profile management from finances: "Modelos" detail becomes profile+photos with edit; "Ganancias por modelo" becomes the financial hub (cumulative balance, payment, per-day breakdown with amount editing).

**Architecture:** Add `PUT` amount-edit endpoints for loans/fines in thrall (services already have PUT). In sylvanas, strip the financial sections from the model-detail page and add a profile-edit form; rebuild the model-earnings page to show a cumulative balance card + payment + a per-day breakdown grouping services/loans/fines, each editable-amount row gated behind a pencil.

**Tech Stack:** Hono + Drizzle + Turso (thrall); Next.js 15 App Router + shadcn/ui base-ui (sylvanas).

## Global Constraints

- Amounts INTEGER (COP), timestamps INTEGER unix ms, IDs ULID. Soft delete via `deleted_at` on fines/loans; payments immutable.
- `PUT /loans/:id` [admin, monitor] and `PUT /fines/:id` [admin] update only `amount` (positive int); 404 if missing or soft-deleted; `logAudit` action `UPDATE`. Services use existing `PUT /services/:id` with `{ basePrice }`.
- Balance = `totalEarnings − totalFines − totalLoans − totalPayments` (cumulative, all-time, NOT date-filtered), from `GET /reports/model-balance/:id`. Per-service earning = `calcEarnings(basePrice, extras).modelTotal`.
- "Today"/day grouping uses `America/Bogota`. Day key = `new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(ms))` → `"YYYY-MM-DD"`.
- After thrall `src/` change: `npm run build` (tsup → `dist/index.mjs`) and commit the bundle. Tests: `npm test` (vitest). sylvanas verify: `node_modules/.bin/tsc --noEmit` (NOT `npx tsc`) + `npm run build`.
- shadcn Button/Dialog are base-ui: use the `render` prop, never `asChild`; link-styled buttons use `buttonVariants()` on `<a>`/`<Link>`. Server Actions return `{ error?: string }` and call `revalidatePath`. Toasts via `sonner`.
- The model-earnings and model-balance report routes are admin-only (thrall `requireRole('admin')`), so the whole Ganancias page is admin-only.

---

## Task 1: thrall — PUT amount for loans and fines

**Files:**
- Modify: `thrall/src/routes/loans.ts` (add PUT handler)
- Modify: `thrall/src/routes/fines.ts` (add PUT handler)
- Create: `thrall/tests/routes/edit-amounts.test.ts`
- Modify: `thrall/dist/index.mjs` (rebuild)

**Interfaces:**
- Produces: `PUT /api/loans/:id` [admin, monitor] body `{ amount: number }`; `PUT /api/fines/:id` [admin] body `{ amount: number }`. Both return the updated row; 404 if missing/soft-deleted.

- [ ] **Step 1: Write the failing test** in `thrall/tests/routes/edit-amounts.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import app from '../../src/app'
import { createTestBrand, createTestUser, tokenFor } from '../helpers'

async function setup() {
  const brandId = await createTestBrand()
  const admin = await createTestUser(brandId, { role: 'admin' })
  const monitor = await createTestUser(brandId, { role: 'monitor' })
  const model = await createTestUser(brandId, { role: 'model' })
  return {
    adminToken: await tokenFor(admin.id, 'admin', brandId),
    monitorToken: await tokenFor(monitor.id, 'monitor', brandId),
    modelId: model.id,
  }
}

async function createLoan(token: string, modelId: string, amount: number) {
  const res = await app.request('/api/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ modelId, amount, reason: 'x' }),
  })
  return (await res.json()).id as string
}
async function createFine(token: string, modelId: string, amount: number) {
  const res = await app.request('/api/fines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ modelId, amount, reason: 'x' }),
  })
  return (await res.json()).id as string
}

describe('edit loan/fine amount', () => {
  it('monitor can edit a loan amount', async () => {
    const { adminToken, monitorToken, modelId } = await setup()
    const id = await createLoan(adminToken, modelId, 10000)
    const res = await app.request(`/api/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ amount: 15000 }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).amount).toBe(15000)
  })

  it('rejects non-positive loan amount', async () => {
    const { adminToken, modelId } = await setup()
    const id = await createLoan(adminToken, modelId, 10000)
    const res = await app.request(`/api/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 0 }),
    })
    expect(res.status).toBe(400)
  })

  it('admin can edit a fine amount; monitor cannot', async () => {
    const { adminToken, monitorToken, modelId } = await setup()
    const id = await createFine(adminToken, modelId, 5000)
    const denied = await app.request(`/api/fines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${monitorToken}` },
      body: JSON.stringify({ amount: 8000 }),
    })
    expect(denied.status).toBe(403)
    const ok = await app.request(`/api/fines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 8000 }),
    })
    expect(ok.status).toBe(200)
    expect((await ok.json()).amount).toBe(8000)
  })

  it('404 on missing loan', async () => {
    const { adminToken } = await setup()
    const res = await app.request('/api/loans/nope', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 1000 }),
    })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd thrall && npm test -- edit-amounts`
Expected: FAIL (PUT routes not defined → 404).

- [ ] **Step 3: Add the PUT handler to `thrall/src/routes/loans.ts`** (before the `delete` handler)

```ts
const amountSchema = z.object({ amount: z.number().int().positive() })

loansRoutes.put('/:id', requireRole('admin', 'monitor'), zValidator('json', amountSchema), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')!
  const { amount } = c.req.valid('json')

  const existing = await db.query.loans.findFirst({
    where: (l, { and, eq: eqFn, isNull }) => and(eqFn(l.id, id), isNull(l.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.update(loans).set({ amount }).where(eq(loans.id, id))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'loan', entityId: id })
  const updated = await db.query.loans.findFirst({ where: eq(loans.id, id) })
  return c.json(updated)
})
```

- [ ] **Step 4: Add the PUT handler to `thrall/src/routes/fines.ts`** (before the `delete` handler)

```ts
const amountSchema = z.object({ amount: z.number().int().positive() })

finesRoutes.put('/:id', requireRole('admin'), zValidator('json', amountSchema), async (c) => {
  const caller = c.get('user')
  const id = c.req.param('id')!
  const { amount } = c.req.valid('json')

  const existing = await db.query.fines.findFirst({
    where: (f, { and, eq: eqFn, isNull }) => and(eqFn(f.id, id), isNull(f.deletedAt)),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.update(fines).set({ amount }).where(eq(fines.id, id))
  await logAudit(db, { userId: caller.sub, action: 'UPDATE', entity: 'fine', entityId: id })
  const updated = await db.query.fines.findFirst({ where: eq(fines.id, id) })
  return c.json(updated)
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd thrall && npm test -- edit-amounts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run full suite + typecheck**

Run: `cd thrall && npm test && npx tsc --noEmit`
Expected: all pass; 0 type errors.

- [ ] **Step 7: Rebuild the bundle**

Run: `cd thrall && npm run build`
Expected: `dist/index.mjs` rebuilt, no errors.

- [ ] **Step 8: Commit**

```bash
git add thrall/src/routes/loans.ts thrall/src/routes/fines.ts thrall/tests/routes/edit-amounts.test.ts thrall/dist/index.mjs
git commit -m "feat(thrall): PUT amount for loans (admin+monitor) and fines (admin)"
```

---

## Task 2: sylvanas — Modelos detail becomes profile edit + photos

**Files:**
- Create: `sylvanas/app/dashboard/models/[id]/profile-actions.ts`
- Create: `sylvanas/app/dashboard/models/[id]/profile-edit-form.tsx`
- Modify: `sylvanas/app/dashboard/models/[id]/page.tsx` (remove financial sections; add profile edit)

**Interfaces:**
- Consumes: `apiFetch`, `User` type, `ImageUploader`, `DeleteImageButton`.
- Produces: `updateModelProfile(id, data)` server action.

- [ ] **Step 1: Create `sylvanas/app/dashboard/models/[id]/profile-actions.ts`**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export interface ProfileInput {
  name: string
  email: string
  phone?: string
  telegram?: string
  description?: string
}

export async function updateModelProfile(
  id: string,
  data: ProfileInput
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" }
  }
  revalidatePath(`/dashboard/models/${id}`)
  return {}
}
```

- [ ] **Step 2: Create `sylvanas/app/dashboard/models/[id]/profile-edit-form.tsx`**

```tsx
"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { updateModelProfile } from "./profile-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Correo inválido"),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function ProfileEditForm({
  id,
  initial,
}: {
  id: string
  initial: FormValues
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initial })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await updateModelProfile(id, {
        ...values,
        phone: values.phone || undefined,
        telegram: values.telegram || undefined,
        description: values.description || undefined,
      })
      if (res.error) toast.error(res.error)
      else toast.success("Perfil actualizado")
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-name">Nombre</Label>
          <Input id="p-name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-email">Correo</Label>
          <Input id="p-email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-phone">Teléfono</Label>
          <Input id="p-phone" {...register("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-telegram">Telegram</Label>
          <Input id="p-telegram" {...register("telegram")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-description">Descripción</Label>
        <Textarea id="p-description" rows={3} {...register("description")} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Rewrite `sylvanas/app/dashboard/models/[id]/page.tsx`** to remove all financial sections and render profile edit + gallery only

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { apiFetch, ApiError } from "@/lib/api"
import type { Model, User } from "@/lib/types"
import { ImageUploader } from "./image-uploader"
import { DeleteImageButton } from "./delete-image-button"
import { ProfileEditForm } from "./profile-edit-form"

export const dynamic = "force-dynamic"

async function getModelImages(id: string): Promise<Model["images"]> {
  try {
    const m = await apiFetch<Model>(`/models/${id}`)
    return m.images
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return []
    throw e
  }
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let user: User
  try {
    user = await apiFetch<User>(`/users/${id}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound()
    throw e
  }

  const images = await getModelImages(id)

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/models" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver a modelos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{user.name}</h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Perfil</h2>
        <ProfileEditForm
          id={id}
          initial={{
            name: user.name,
            email: user.email,
            phone: user.phone ?? "",
            telegram: user.telegram ?? "",
            description: user.description ?? "",
          }}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Galería</h2>
        <ImageUploader userId={id} />
        {images.length === 0 ? (
          <p className="text-muted-foreground">Sin imágenes.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={user.name}
                  className="aspect-[3/4] w-full rounded-lg object-cover"
                />
                <DeleteImageButton imageId={img.id} userId={id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Delete the now-unused financial components from this folder**

```bash
cd sylvanas
git rm app/dashboard/models/\[id\]/payment-dialog.tsx app/dashboard/models/\[id\]/settlement-actions.ts
```
(These move to model-earnings in Task 3. If `git rm` reports they are not tracked, use `rm`.)

- [ ] **Step 5: Verify typecheck + build**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build`
Expected: 0 type errors; build succeeds; `/dashboard/models/[id]` compiles.

- [ ] **Step 6: Commit**

```bash
git add sylvanas/app/dashboard/models/\[id\]
git commit -m "feat(sylvanas): model detail is profile edit + photos (financials removed)"
```

---

## Task 3: sylvanas — Ganancias por modelo: balance card + payment + history

**Files:**
- Create: `sylvanas/app/dashboard/model-earnings/settlement-actions.ts`
- Create: `sylvanas/app/dashboard/model-earnings/payment-dialog.tsx`
- Modify: `sylvanas/app/dashboard/model-earnings/page.tsx` (add balance card + payment + history above the existing table)

**Interfaces:**
- Consumes: `apiFetch`, `ModelBalance`, `Payment`, `PayMethod` types, `formatCOP`, `formatBogotaDate`.
- Produces: `createPayment(modelId, amount, payMethodId)` server action; `PaymentDialog` component.

- [ ] **Step 1: Create `sylvanas/app/dashboard/model-earnings/settlement-actions.ts`**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export async function createPayment(
  modelId: string,
  amount: number,
  payMethodId: string
): Promise<{ error?: string }> {
  try {
    await apiFetch("/payments", {
      method: "POST",
      body: JSON.stringify({ modelId, amount, payMethodId }),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al registrar el pago" }
  }
  revalidatePath("/dashboard/model-earnings")
  return {}
}
```

- [ ] **Step 2: Create `sylvanas/app/dashboard/model-earnings/payment-dialog.tsx`**

```tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createPayment } from "./settlement-actions"
import { formatCOP } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  amount: z.coerce.number().int().positive("Monto inválido"),
  payMethodId: z.string().min(1, "Selecciona un método"),
})
type FormValues = z.input<typeof schema>

export function PaymentDialog({
  modelId,
  currentBalance,
  payMethods,
}: {
  modelId: string
  currentBalance: number
  payMethods: { id: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: Math.max(0, currentBalance) } as FormValues,
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await createPayment(modelId, Number(values.amount), values.payMethodId)
      if (res.error) { toast.error(res.error); return }
      toast.success("Pago registrado")
      setOpen(false)
    })
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Realizar pago</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Realizar pago — saldo actual {formatCOP(currentBalance)}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Monto a pagar</Label>
            <Input id="pay-amount" type="number" min={1} step={1} {...register("amount")} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-method">Método de pago</Label>
            <select id="pay-method" className={selectClass} {...register("payMethodId")}>
              <option value="">Selecciona…</option>
              {payMethods.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
            </select>
            {errors.payMethodId && <p className="text-sm text-destructive">{errors.payMethodId.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando…" : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Add the balance card + payment history to `sylvanas/app/dashboard/model-earnings/page.tsx`**

Add imports: `ModelBalance`, `Payment`, `PayMethod` from `@/lib/types`; `Card, CardContent` from `@/components/ui/card`; `PaymentDialog` from `./payment-dialog`; `cn` from `@/lib/utils`.

Inside the `if (sp.modelId)` branch (where `report` is fetched), also fetch balance, payments, pay-methods:
```ts
const [balance, payments, payMethods] = await Promise.all([
  apiFetch<ModelBalance>(`/reports/model-balance/${sp.modelId}`),
  apiFetch<Payment[]>(`/payments?modelId=${sp.modelId}`),
  apiFetch<PayMethod[]>("/pay-methods"),
])
const payOptions = payMethods.map((p) => ({
  id: p.id,
  label: p.displayName ? `${p.code} — ${p.displayName}` : p.code,
}))
const payCode = new Map(payMethods.map((p) => [p.id, p.displayName ? `${p.code} — ${p.displayName}` : p.code]))
```

Render, immediately after the controls and before the per-service table (only when `sp.modelId` and `balance` exist):
```tsx
<Card>
  <CardContent className="space-y-2 py-4">
    <p className="text-sm text-muted-foreground">Saldo a pagar</p>
    <p className={cn("text-3xl font-semibold", balance.balance < 0 && "text-destructive")}>
      {formatCOP(balance.balance)}
    </p>
    <div className="grid grid-cols-2 gap-2 pt-2 text-sm sm:grid-cols-4">
      <div><span className="text-muted-foreground">Ganancias </span>{formatCOP(balance.totalEarnings)}</div>
      <div><span className="text-muted-foreground">− Multas </span>{formatCOP(balance.totalFines)}</div>
      <div><span className="text-muted-foreground">− Préstamos </span>{formatCOP(balance.totalLoans)}</div>
      <div><span className="text-muted-foreground">− Pagos </span>{formatCOP(balance.totalPayments)}</div>
    </div>
    <div className="pt-3">
      <PaymentDialog modelId={sp.modelId} currentBalance={balance.balance} payMethods={payOptions} />
    </div>
  </CardContent>
</Card>
```

And a payment-history section after the balance card:
```tsx
{payments.length > 0 && (
  <section className="space-y-3">
    <h2 className="text-lg font-medium">Historial de pagos</h2>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead><TableHead>Monto</TableHead><TableHead>Método</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{formatBogotaDate(p.createdAt)}</TableCell>
            <TableCell>{formatCOP(p.amount)}</TableCell>
            <TableCell>{payCode.get(p.payMethodId) ?? p.payMethodId}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </section>
)}
```

Keep the existing per-service earnings table for now (Task 4 replaces it with the per-day breakdown).

- [ ] **Step 4: Verify typecheck + build**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build`
Expected: 0 type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add sylvanas/app/dashboard/model-earnings
git commit -m "feat(sylvanas): balance card + settlement + payment history on model-earnings"
```

---

## Task 4: sylvanas — Ganancias por modelo: per-day breakdown + amount editing

**Files:**
- Modify: `sylvanas/lib/utils.ts` (add `bogotaDayKey`)
- Create: `sylvanas/app/dashboard/model-earnings/edit-actions.ts`
- Create: `sylvanas/app/dashboard/model-earnings/editable-amount.tsx`
- Modify: `sylvanas/app/dashboard/model-earnings/page.tsx` (replace per-service table with per-day breakdown)

**Interfaces:**
- Consumes: `apiFetch`, `Fine`, `Loan` types, `formatCOP`, `formatBogotaDate`, `bogotaDayKey`.
- Produces: `editServiceAmount(id, basePrice)`, `editLoanAmount(id, amount)`, `editFineAmount(id, amount)` actions; `EditableAmount` component.

- [ ] **Step 1: Add `bogotaDayKey` to `sylvanas/lib/utils.ts`**

```ts
/** "YYYY-MM-DD" day key in America/Bogota, for grouping by day. */
export function bogotaDayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(ms)
  )
}
```

- [ ] **Step 2: Create `sylvanas/app/dashboard/model-earnings/edit-actions.ts`**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

async function put(path: string, body: object): Promise<{ error?: string }> {
  try {
    await apiFetch(path, { method: "PUT", body: JSON.stringify(body) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" }
  }
  revalidatePath("/dashboard/model-earnings")
  return {}
}

export async function editServiceAmount(id: string, basePrice: number) {
  return put(`/services/${id}`, { basePrice })
}
export async function editLoanAmount(id: string, amount: number) {
  return put(`/loans/${id}`, { amount })
}
export async function editFineAmount(id: string, amount: number) {
  return put(`/fines/${id}`, { amount })
}
```

- [ ] **Step 3: Create `sylvanas/app/dashboard/model-earnings/editable-amount.tsx`**

```tsx
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { editServiceAmount, editLoanAmount, editFineAmount } from "./edit-actions"
import { formatCOP } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Kind = "service" | "loan" | "fine"

const ACTIONS: Record<Kind, (id: string, value: number) => Promise<{ error?: string }>> = {
  service: editServiceAmount,
  loan: editLoanAmount,
  fine: editFineAmount,
}

export function EditableAmount({
  kind,
  id,
  value,
}: {
  kind: Kind
  id: string
  value: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [isPending, startTransition] = useTransition()

  function save() {
    const n = Number(draft)
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("Monto inválido")
      return
    }
    startTransition(async () => {
      const res = await ACTIONS[kind](id, n)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Monto actualizado")
        setEditing(false)
      }
    })
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        {formatCOP(value)}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Editar monto"
          onClick={() => {
            setDraft(String(value))
            setEditing(true)
          }}
        >
          ✏️
        </Button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Input
        type="number"
        min={1}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 w-28"
      />
      <Button type="button" size="sm" onClick={save} disabled={isPending}>
        {isPending ? "…" : "Guardar"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancelar
      </Button>
    </span>
  )
}
```

- [ ] **Step 4: Replace the per-service table in `page.tsx` with a per-day breakdown**

In `sylvanas/app/dashboard/model-earnings/page.tsx`, inside the `if (sp.modelId)` branch, also fetch fines and loans and filter to the model + date range:
```ts
const [allFines, allLoans] = await Promise.all([
  apiFetch<Fine[]>("/fines"),
  apiFetch<Loan[]>("/loans"),
])
const fromMs = dayStartBogotaMs(from)
const toMs = dayEndBogotaMs(to)
const fines = allFines.filter(
  (f) => f.modelId === sp.modelId && f.deletedAt === null && f.createdAt >= fromMs && f.createdAt <= toMs
)
const loans = allLoans.filter(
  (l) => l.modelId === sp.modelId && l.deletedAt === null && l.createdAt >= fromMs && l.createdAt <= toMs
)
```
(Import `Fine`, `Loan` from `@/lib/types`; `bogotaDayKey`, `dayStartBogotaMs`, `dayEndBogotaMs` are in `@/lib/utils`; `report.rows` are the services for the range.)

Build a per-day map combining the three sources. Each day key → `{ services: ServiceRow[], fines: Fine[], loans: Loan[] }`:
```ts
type DayGroup = {
  services: typeof report.rows
  fines: typeof fines
  loans: typeof loans
}
const days = new Map<string, DayGroup>()
function bucket(key: string): DayGroup {
  let g = days.get(key)
  if (!g) { g = { services: [], fines: [], loans: [] }; days.set(key, g) }
  return g
}
for (const s of report.rows) bucket(bogotaDayKey(s.startTime)).services.push(s)
for (const f of fines) bucket(bogotaDayKey(f.createdAt)).fines.push(f)
for (const l of loans) bucket(bogotaDayKey(l.createdAt)).loans.push(l)
const dayKeys = [...days.keys()].sort().reverse() // newest day first
```

Replace the old `<Table>` of `report.rows` with a per-day render (keep the totals footer idea inside the balance card, not here). For each `dayKey` in `dayKeys`, render a block:
```tsx
{dayKeys.map((key) => {
  const g = days.get(key)!
  const loansTotal = g.loans.reduce((s, l) => s + l.amount, 0)
  return (
    <section key={key} className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          {formatBogotaDate(dayStartBogotaMs(key), { dateStyle: "full" })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {g.services.length} servicio(s) · pedido {formatCOP(loansTotal)}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Concepto</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right">Ganancia modelo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {g.services.map((s) => (
            <TableRow key={s.id}>
              <TableCell>Servicio</TableCell>
              <TableCell className="text-muted-foreground">
                {formatBogotaDate(s.startTime, { hour: "2-digit", minute: "2-digit" })}
                {s.extras.length > 0 ? ` · +${formatCOP(s.modelExtras)} extras` : ""}
              </TableCell>
              <TableCell className="text-right">
                <EditableAmount kind="service" id={s.id} value={s.basePrice} />
              </TableCell>
              <TableCell className="text-right font-medium">{formatCOP(s.modelTotal)}</TableCell>
            </TableRow>
          ))}
          {g.loans.map((l) => (
            <TableRow key={l.id}>
              <TableCell>Préstamo</TableCell>
              <TableCell className="text-muted-foreground">{l.reason}</TableCell>
              <TableCell className="text-right">
                <EditableAmount kind="loan" id={l.id} value={l.amount} />
              </TableCell>
              <TableCell className="text-right text-muted-foreground">− {formatCOP(l.amount)}</TableCell>
            </TableRow>
          ))}
          {g.fines.map((f) => (
            <TableRow key={f.id}>
              <TableCell>Multa</TableCell>
              <TableCell className="text-muted-foreground">{f.reason}</TableCell>
              <TableCell className="text-right">
                <EditableAmount kind="fine" id={f.id} value={f.amount} />
              </TableCell>
              <TableCell className="text-right text-muted-foreground">− {formatCOP(f.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
})}
```
Remove the old single `report.rows` table and its totals `<TableFooter>` (the cumulative balance card now carries the money summary). Keep the "selecciona una modelo" empty state and the "no hay servicios" case (show it when `dayKeys.length === 0`).

- [ ] **Step 5: Verify typecheck + build**

Run: `cd sylvanas && node_modules/.bin/tsc --noEmit && npm run build`
Expected: 0 type errors; build succeeds; `/dashboard/model-earnings` compiles.

- [ ] **Step 6: Commit**

```bash
git add sylvanas/app/dashboard/model-earnings sylvanas/lib/utils.ts
git commit -m "feat(sylvanas): per-day breakdown with inline amount editing on model-earnings"
```

---

## Self-Review Notes

- **Spec coverage:** PUT loans/fines amount (Task 1) ✓; Modelos → profile edit + photos, financials removed (Task 2) ✓; balance card + payment + history moved to model-earnings (Task 3) ✓; per-day breakdown + pencil amount edit (Task 4) ✓. Calendar and monitor/admin profile edit correctly OUT of scope (not in any task).
- **Permissions:** PUT loans [admin, monitor], PUT fines [admin] — enforced server-side (Task 1). The Ganancias page is admin-only (report endpoints), so edits happen as admin.
- **Balance is cumulative:** the balance card uses `/reports/model-balance/:id` (no date filter); the per-day breakdown uses the date range. Consistent with spec §4.
- **Type consistency:** `ModelBalance`, `Payment`, `PayMethod`, `Fine`, `Loan`, `User` already exist in `sylvanas/lib/types.ts`. `report.rows` shape (`{ id, startTime, endTime, basePrice, extras, modelBase, modelExtras, modelTotal }`) comes from the existing `/reports/model-earnings/:id`. Edit actions PUT to the endpoints defined in Task 1 and the existing services PUT.
- **Cleanup:** Task 2 removes `payment-dialog.tsx` + `settlement-actions.ts` from `models/[id]`; Task 3 recreates equivalents under `model-earnings/`. No dangling imports (the model detail page no longer references them).
