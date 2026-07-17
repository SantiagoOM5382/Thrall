"use client"
import { useState } from "react"

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
          <div key={p.id} className="rounded-lg border p-6 flex flex-col">
            <h3 className="text-lg font-semibold">{p.displayName}</h3>
            <p className="text-2xl font-bold mt-2">{formatCop(p.priceCop)}</p>
            <p className="text-sm text-neutral-500 mt-1">{p.subtitle}</p>
            <button
              onClick={() => choose(p.id)}
              disabled={pending !== null}
              className="mt-6 rounded bg-black text-white px-4 py-2 disabled:opacity-50"
            >
              {pending === p.id ? "Redirigiendo…" : "Elegir plan"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  )
}
