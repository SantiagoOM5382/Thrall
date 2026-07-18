"use client"
import { useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Product = {
  id: string
  code: string
  displayName: string
  priceCop: number
  subtitle: string
}

function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
}

export function ProductCards<P extends Product>({
  products,
  purchaseAction,
}: {
  products: P[]
  purchaseAction: (productId: string) => Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }>
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(productId: string) {
    setPending(productId); setError(null)
    const r = await purchaseAction(productId)
    if (r.ok) {
      window.location.href = r.checkoutUrl
    } else {
      setPending(null)
      setError("No se pudo iniciar el pago. Inténtalo de nuevo.")
    }
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {products.map(p => (
          <div
            key={p.id}
            className="flex flex-col rounded-xl border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <h3 className="font-heading font-semibold tracking-tight">{p.displayName}</h3>
            <p className="mt-2 text-2xl font-bold tabular-nums text-primary">{formatCop(p.priceCop)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.subtitle}</p>
            <Button
              onClick={() => choose(p.id)}
              disabled={pending !== null}
              className="mt-6 gap-2"
            >
              {pending === p.id && <Loader2 className="size-4 animate-spin" />}
              {pending === p.id ? "Redirigiendo…" : "Elegir plan"}
            </Button>
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
    </div>
  )
}
