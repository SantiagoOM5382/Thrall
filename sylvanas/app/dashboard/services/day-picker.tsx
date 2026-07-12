"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DayPicker({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function onChange(date: string) {
    const next = new URLSearchParams(params.toString())
    if (date) next.set("date", date)
    else next.delete("date")
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="day" className="text-sm text-muted-foreground">
        Día
      </Label>
      <Input
        id="day"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40"
      />
    </div>
  )
}
