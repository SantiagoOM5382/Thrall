"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Label } from "@/components/ui/label"

export function ModelSelect({
  models,
}: {
  models: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get("modelId") ?? ""

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set("modelId", value)
    else next.delete("modelId")
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="modelId">Modelo</Label>
      <select
        id="modelId"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-56 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Selecciona una modelo…</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  )
}
