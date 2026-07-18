import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"
import { getSession } from "@/lib/session"
import { apiFetch } from "@/lib/api"
import type { Model, PayMethod } from "@/lib/types"
import { buttonVariants } from "@/components/ui/button"
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
      <div>
        <Link
          href="/dashboard/services"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Servicios
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nuevo servicio</h1>
      </div>

      {models.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-5" />
          </span>
          <p className="max-w-xs text-muted-foreground">
            Todavía no tienes modelos registradas. Crea una primero para poder registrar servicios.
          </p>
          <Link href="/dashboard/models" className={buttonVariants({ variant: "outline" })}>
            Ir a Modelos
          </Link>
        </div>
      ) : (
        <ServiceForm
          models={models.map((m) => ({ id: m.id, name: m.name }))}
          payMethods={payOptions}
        />
      )}
    </div>
  )
}
