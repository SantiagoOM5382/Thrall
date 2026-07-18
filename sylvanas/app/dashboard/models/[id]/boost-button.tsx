"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Sparkles, Loader2, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NativeSelect as Select } from "@/components/shared/native-select"
import { useWallet } from "@/lib/wallet-context"
import { boostModel } from "../actions"

type TopService = {
  id: string
  code: string
  displayName: string
  tokensCost: number
  durationHours: number
}

export function BoostButton({ modelId, services }: { modelId: string; services: TopService[] }) {
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState(services[0]?.id ?? "")
  const wallet = useWallet()

  if (services.length === 0) return null

  const service = services.find((s) => s.id === selected)
  const canAfford = service ? wallet.tokensBalance >= service.tokensCost : false

  function onClick() {
    startTransition(async () => {
      const res = await boostModel(modelId, selected)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Modelo destacada en la vitrina")
        wallet.refetch()
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-56">
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.displayName} — {s.tokensCost} tokens
          </option>
        ))}
      </Select>
      <Button type="button" onClick={onClick} disabled={isPending || !canAfford} className="gap-1.5">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Destacar
      </Button>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Coins className="size-3.5" />
        Saldo: {wallet.tokensBalance} tokens
      </span>
      {!canAfford && (
        <span className="text-xs text-destructive">Saldo insuficiente</span>
      )}
    </div>
  )
}
