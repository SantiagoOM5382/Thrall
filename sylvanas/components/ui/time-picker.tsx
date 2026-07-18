"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function Column({
  values,
  selected,
  onSelect,
}: {
  values: number[]
  selected: number
  onSelect: (v: number) => void
}) {
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center" })
  }, [])

  return (
    <div className="h-48 w-14 overflow-y-auto scroll-smooth">
      {values.map((v) => {
        const active = v === selected
        return (
          <button
            key={v}
            ref={active ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(v)}
            className={cn(
              "flex w-full items-center justify-center rounded-md py-1.5 text-sm tabular-nums transition-colors",
              active ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {pad(v)}
          </button>
        )
      })}
    </div>
  )
}

/** Two scrollable columns (hour, minute in 5-min steps) — pairs with Calendar's popover styling. */
export function TimePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [hStr, mStr] = value ? value.split(":") : ["00", "00"]
  const hour = Number(hStr) || 0
  const minute = Math.round((Number(mStr) || 0) / 5) * 5

  return (
    <div className="flex gap-1 divide-x">
      <Column values={HOURS} selected={hour} onSelect={(h) => onChange(`${pad(h)}:${pad(minute)}`)} />
      <Column values={MINUTES} selected={minute} onSelect={(m) => onChange(`${pad(hour)}:${pad(m)}`)} />
    </div>
  )
}
