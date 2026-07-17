import { apiFetch } from "@/lib/api"
import { ProductCards } from "@/components/shared/ProductCards"
import { purchaseTokens } from "./actions"

type TokenProduct = {
  id: string
  code: string
  displayName: string
  priceCop: number
  tokensGranted: number
}

type Wallet = { tokensBalance: number; tokenDiscountPercent: number }

export default async function TokensPage() {
  const [products, wallet] = await Promise.all([
    apiFetch<TokenProduct[]>("/products?type=TOKEN_PACK").catch(() => [] as TokenProduct[]),
    apiFetch<Wallet>("/brand/wallet").catch(() => ({ tokensBalance: 0, tokenDiscountPercent: 0 })),
  ])

  return (
    <div className="mx-auto max-w-4xl py-8 space-y-8">
      <section className="rounded-lg border bg-neutral-50 p-6">
        <h2 className="text-lg font-semibold">Tu saldo</h2>
        <p className="text-3xl font-bold mt-1">{wallet.tokensBalance} tokens</p>
        {wallet.tokenDiscountPercent > 0 && (
          <p className="text-sm text-emerald-700 mt-2">
            Tienes {wallet.tokenDiscountPercent}% de descuento en compras de tokens por tu plan activo.
          </p>
        )}
      </section>
      <section>
        <h1 className="text-2xl font-semibold mb-4">Comprar tokens</h1>
        <ProductCards
          products={products}
          purchaseAction={purchaseTokens}
          subtitle={(p) => `${p.tokensGranted} tokens`}
        />
      </section>
    </div>
  )
}
