"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"]
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Grid cells for the visible month, Monday-first, padded with the trailing
// days of the previous/next month so every row has 7 columns.
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // 0=Monday
  const gridStart = new Date(year, month, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

export function Calendar({
  selected,
  onSelect,
  defaultMonth,
}: {
  selected?: Date
  onSelect: (date: Date) => void
  defaultMonth?: Date
}) {
  const [cursor, setCursor] = useState(defaultMonth ?? selected ?? new Date())
  const today = new Date()
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const days = buildMonthGrid(year, month)

  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-medium">
          {MONTHS[month]} {year}
        </p>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[0.7rem] font-medium text-muted-foreground">
            {w}
          </span>
        ))}
        {days.map((d) => {
          const inMonth = d.getMonth() === month
          const isToday = isSameDay(d, today)
          const isSelected = selected ? isSameDay(d, selected) : false
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className={cn(
                "mx-auto flex size-8 items-center justify-center rounded-full text-sm transition-colors",
                !inMonth && "text-muted-foreground/40",
                inMonth && !isSelected && "hover:bg-muted",
                isToday && !isSelected && "font-semibold text-primary",
                isSelected && "bg-primary font-semibold text-primary-foreground"
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
