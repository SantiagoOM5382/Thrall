import { Coins } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { ProductCards } from "@/components/shared/ProductCards"
import { StatCard } from "@/components/shared/stat-card"
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
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tokens</h1>
        <p className="mt-1 text-muted-foreground">
          Compra tokens y úsalos para destacar a tus modelos en la vitrina pública.
        </p>
      </div>

      <StatCard
        label="Tu saldo"
        value={`${wallet.tokensBalance} tokens`}
        icon={Coins}
        tone="gold"
        hint={
          wallet.tokenDiscountPercent > 0
            ? `${wallet.tokenDiscountPercent}% de descuento en compras por tu plan activo`
            : undefined
        }
      />

      <section>
        <h2 className="mb-4 text-lg font-medium">Comprar tokens</h2>
        <ProductCards
          products={products.map((p) => ({ ...p, subtitle: `${p.tokensGranted} tokens` }))}
          purchaseAction={purchaseTokens}
        />
      </section>
    </div>
  )
}
