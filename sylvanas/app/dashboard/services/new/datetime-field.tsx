"use client"

import { useState } from "react"
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

// Splits a "YYYY-MM-DDTHH:mm" local value into its date and time parts.
function parseLocal(value: string): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: "" }
  const [datePart, timePart] = value.split("T")
  const [y, m, d] = datePart.split("-").map(Number)
  if (!y || !m || !d) return { date: undefined, time: timePart ?? "" }
  return { date: new Date(y, m - 1, d), time: timePart ?? "" }
}

function toLocalValue(date: Date, time: string): string {
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  return `${y}-${m}-${d}T${time || "00:00"}`
}

/**
 * Replaces the native <input type="datetime-local"> — its calendar popup
 * can't be restyled by any browser and looks noticeably worse than the rest
 * of the app. Pairs a custom Calendar in a Popover for the date with a
 * native <input type="time"> (renders cleanly, no need to reinvent it).
 */
export function DateTimeField<T extends FieldValues>({
  control,
  name,
  id,
  invalid,
}: {
  control: Control<T>
  name: Path<T>
  id: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const value = (field.value as string | undefined) ?? ""
        const { date, time } = parseLocal(value)

        return (
          <div className="flex gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                id={id}
                type="button"
                className={cn(
                  "flex h-9 flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  invalid && "border-destructive"
                )}
              >
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                {date ? (
                  date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
                ) : (
                  <span className="text-muted-foreground">Fecha</span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start">
                <Calendar
                  selected={date}
                  onSelect={(d) => {
                    field.onChange(toLocalValue(d, time || "12:00"))
                    setOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              aria-label="Hora"
              className="w-28 tabular-nums"
              value={time}
              onChange={(e) => field.onChange(toLocalValue(date ?? new Date(), e.target.value))}
            />
          </div>
        )
      }}
    />
  )
}
