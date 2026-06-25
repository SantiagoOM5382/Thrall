import { apiFetch } from "@/lib/api"
import {
  formatCOP,
  todayBogota,
  dayStartBogotaMs,
  dayEndBogotaMs,
} from "@/lib/utils"
import { DateRangePicker } from "@/components/shared/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    { label: "Servicios", value: report.totalServices.toString() },
    { label: "Total base", value: formatCOP(report.totalBase) },
    { label: "Ganancia empresa (40%)", value: formatCOP(report.companyEarnings) },
    {
      label: "Ganancia modelos (60% + extras)",
      value: formatCOP(report.modelTotalEarnings),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ganancias empresa</h1>
      <DateRangePicker />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {report.totalServices === 0 && (
        <p className="text-muted-foreground">
          No hay servicios en el período seleccionado.
        </p>
      )}
    </div>
  )
}
