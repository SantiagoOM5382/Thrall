import { apiFetch } from "@/lib/api"
import {
  formatCOP,
  todayBogota,
  dayStartBogotaMs,
  dayEndBogotaMs,
} from "@/lib/utils"
import { DateRangePicker } from "@/components/shared/date-range-picker"
import { StatCard } from "@/components/shared/stat-card"
import { PaidGate } from "@/components/shared/PaidGate"
import { getSubscription } from "@/lib/subscription-server"
import { UpsellCard } from "@/components/shared/UpsellCard"
import { CalendarCheck2, Coins, Building2, Wallet } from "lucide-react"

export const dynamic = "force-dynamic"

interface EarningsReport {
  totalServices: number
  totalBase: number
  companyEarnings: number
  modelBaseEarnings: number
  modelExtraEarnings: number
  modelTotalEarnings: number
}

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sub = await getSubscription()
  if (!sub.isPaidEffective) {
    return <UpsellCard reason={sub.status === "expired" ? "trial_expired" : "free"} />
  }

  const sp = await searchParams
  const today = todayBogota()
  const from = sp.from ?? today
  const to = sp.to ?? today

  const fromMs = dayStartBogotaMs(from)
  const toMs = dayEndBogotaMs(to)

  const report = await apiFetch<EarningsReport>(
    `/reports/earnings?from=${fromMs}&to=${toMs}`
  )

  const cards = [
    {
      label: "Servicios",
      value: report.totalServices.toString(),
      icon: CalendarCheck2,
      tone: "muted" as const,
    },
    {
      label: "Total base",
      value: formatCOP(report.totalBase),
      icon: Coins,
      tone: "neutral" as const,
    },
    {
      label: "Ganancia empresa",
      value: formatCOP(report.companyEarnings),
      icon: Building2,
      tone: "gold" as const,
      hint: "40% de la base",
    },
    {
      label: "Ganancia modelos",
      value: formatCOP(report.modelTotalEarnings),
      icon: Wallet,
      tone: "positive" as const,
      hint: "60% + extras",
    },
  ]

  return (
    <PaidGate>
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ganancias empresa</h1>
      <DateRangePicker />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            tone={c.tone}
            hint={c.hint}
          />
        ))}
      </div>

      {report.totalServices === 0 && (
        <p className="text-muted-foreground">
          No hay servicios en el período seleccionado.
        </p>
      )}
    </div>
    </PaidGate>
  )
}
