"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DateRangePicker() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""

  function update(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="from">Desde</Label>
        <Input
          id="from"
          type="date"
          value={from}
          onChange={(e) => update("from", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to">Hasta</Label>
        <Input
          id="to"
          type="date"
          value={to}
          onChange={(e) => update("to", e.target.value)}
        />
      </div>
    </div>
  )
}
