import { getSubscription } from "@/lib/subscription-server"
import { apiFetch } from "@/lib/api"
import { PlanCards } from "./PlanCards"

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
      <div className="mx-auto max-w-2xl mt-16 rounded-lg border p-8 text-center">
        <h2 className="text-xl font-semibold">Cuenta especial</h2>
        <p className="text-neutral-600 mt-2">Tu cuenta no requiere suscripción.</p>
      </div>
    )
  }

  const isPaid = sub.isPaidEffective && sub.tier === "paid"

  return (
    <div className="mx-auto max-w-4xl py-8 space-y-8">
      {isPaid && sub.paidUntil && (
        <section className="rounded-lg border bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold">Suscripción activa</h2>
          <p className="text-neutral-700 mt-1">Tu plan vence el <b>{formatDate(sub.paidUntil)}</b>.</p>
          <p className="text-sm text-neutral-500 mt-2">Puedes renovar o cambiar de plan; los días se acumulan.</p>
        </section>
      )}
      <section>
        <h1 className="text-2xl font-semibold mb-4">
          {isPaid ? "Renovar o cambiar plan" : "Elige tu plan"}
        </h1>
        <PlanCards products={products} />
      </section>
    </div>
  )
}
