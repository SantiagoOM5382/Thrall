import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "gold" | "positive" | "muted"

const TONES: Record<Tone, { chip: string; value: string; rail: string }> = {
  neutral: {
    chip: "bg-secondary text-secondary-foreground",
    value: "text-foreground",
    rail: "bg-border",
  },
  gold: {
    chip: "bg-accent text-accent-foreground",
    value: "text-foreground",
    rail: "bg-gold",
  },
  positive: {
    chip: "bg-positive/12 text-positive",
    value: "text-foreground",
    rail: "bg-positive",
  },
  muted: {
    chip: "bg-muted text-muted-foreground",
    value: "text-muted-foreground",
    rail: "bg-border",
  },
}

interface StatCardProps {
  label: string
  value: string
  icon?: LucideIcon
  tone?: Tone
  hint?: string
}

/**
 * A single figure in the ledger: an eyebrow label, a large tabular value, and a
 * tone that encodes what the number means (gold = the house, positive = paid to
 * models). The left rail carries the tone so a column of cards scans at a glance.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
}: StatCardProps) {
  const t = TONES[tone]
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <span className={cn("absolute inset-y-0 left-0 w-1", t.rail)} />
      <div className="flex items-center justify-between">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md",
              t.chip
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p
        className={cn(
          "font-mono text-2xl font-semibold tracking-tight tabular-nums",
          t.value
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
