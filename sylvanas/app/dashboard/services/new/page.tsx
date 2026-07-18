import { getSession } from "@/lib/session"
import { apiFetch } from "@/lib/api"
import type { Model, PayMethod } from "@/lib/types"
import { ServiceForm } from "./service-form"

export const dynamic = "force-dynamic"

export default async function NewServicePage() {
  const user = await getSession()
  const [models, payMethods] = await Promise.all([
    apiFetch<Model[]>("/brand/models"),
    apiFetch<PayMethod[]>("/pay-methods"),
  ])

  const isAdmin = user?.role === "admin"
  const payOptions = payMethods.map((p) => ({
    id: p.id,
    label: isAdmin && p.displayName ? `${p.code} — ${p.displayName}` : p.code,
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo servicio</h1>
      <ServiceForm
        models={models.map((m) => ({ id: m.id, name: m.name }))}
        payMethods={payOptions}
      />
    </div>
  )
}
