import { CheckCircle2 } from "lucide-react"
import { getSubscription } from "@/lib/subscription-server"
import { apiFetch } from "@/lib/api"
import { ProductCards } from "@/components/shared/ProductCards"
import { createCheckout } from "./actions"

type Product = {
  id: string
  code: string
  displayName: string
  priceCop: number
  durationDays: number
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })
}

export default async function SubscribePage() {
  const [sub, products] = await Promise.all([
    getSubscription(),
    apiFetch<Product[]>("/products?type=SUBSCRIPTION").catch(() => [] as Product[]),
  ])

  if (sub.isGrandfathered) {
    return (
      <div className="mx-auto mt-16 max-w-2xl rounded-xl border bg-card p-8 text-center">
        <h2 className="text-xl font-semibold">Cuenta especial</h2>
        <p className="mt-2 text-muted-foreground">Tu cuenta no requiere suscripción.</p>
      </div>
    )
  }

  const isPaid = sub.isPaidEffective && sub.tier === "paid"

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {isPaid && sub.paidUntil && (
        <section className="flex items-start gap-3 rounded-xl border bg-positive/10 p-6">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" />
          <div>
            <h2 className="text-lg font-semibold">Suscripción activa</h2>
            <p className="mt-1 text-foreground/80">
              Tu plan vence el <b className="tabular-nums">{formatDate(sub.paidUntil)}</b>.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Puedes renovar o cambiar de plan; los días se acumulan.
            </p>
          </div>
        </section>
      )}
      <section>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">
          {isPaid ? "Renovar o cambiar plan" : "Elige tu plan"}
        </h1>
        <ProductCards
          products={products.map(p => ({ ...p, subtitle: `${p.durationDays} días de acceso completo` }))}
          purchaseAction={createCheckout}
        />
      </section>
    </div>
  )
}
