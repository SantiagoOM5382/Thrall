"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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

  if (services.length === 0) return null

  function onClick() {
    startTransition(async () => {
      const res = await boostModel(modelId, selected)
      if (res.error) toast.error(res.error)
      else toast.success("Modelo destacado")
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      >
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.displayName} — {s.tokensCost} tokens
          </option>
        ))}
      </select>
      <Button type="button" size="sm" onClick={onClick} disabled={isPending}>
        {isPending ? "…" : "Destacar"}
      </Button>
    </div>
  )
}
