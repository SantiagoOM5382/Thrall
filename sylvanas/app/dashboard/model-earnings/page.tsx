import { apiFetch } from "@/lib/api"
import type { Model } from "@/lib/types"
import {
  formatCOP,
  formatDuration,
  formatBogotaDate,
  todayBogota,
  dayStartBogotaMs,
  dayEndBogotaMs,
} from "@/lib/utils"
import { DateRangePicker } from "@/components/shared/date-range-picker"
import { ModelSelect } from "./model-select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

interface ModelEarningRow {
  id: string
  startTime: number
  endTime: number
  basePrice: number
  extras: { description: string; amount: number }[]
  modelBase: number
  modelExtras: number
  modelTotal: number
}

interface ModelEarningsReport {
  rows: ModelEarningRow[]
  totals: { totalBase: number; totalModelEarnings: number }
}

export default async function ModelEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ modelId?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const models = await apiFetch<Model[]>("/models")

  const today = todayBogota()
  const from = sp.from ?? today
  const to = sp.to ?? today

  let report: ModelEarningsReport | null = null
  if (sp.modelId) {
    const fromMs = dayStartBogotaMs(from)
    const toMs = dayEndBogotaMs(to)
    report = await apiFetch<ModelEarningsReport>(
      `/reports/model-earnings/${sp.modelId}?from=${fromMs}&to=${toMs}`
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Ganancias por modelo
      </h1>

      <div className="flex flex-wrap items-end gap-4">
        <ModelSelect models={models.map((m) => ({ id: m.id, name: m.name }))} />
        <DateRangePicker />
      </div>

      {!sp.modelId ? (
        <p className="text-muted-foreground">
          Selecciona una modelo para ver sus ganancias.
        </p>
      ) : report && report.rows.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead>Extras</TableHead>
                <TableHead className="text-right">Ganancia modelo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {formatBogotaDate(r.startTime, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>{formatDuration(r.startTime, r.endTime)}</TableCell>
                  <TableCell className="text-right">
                    {formatCOP(r.basePrice)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.extras.length === 0
                      ? "—"
                      : r.extras
                          .map((e) => `${e.description} (${formatCOP(e.amount)})`)
                          .join(", ")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCOP(r.modelTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Totales</TableCell>
                <TableCell className="text-right">
                  {formatCOP(report.totals.totalBase)}
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold">
                  {formatCOP(report.totals.totalModelEarnings)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground">
          No hay servicios para esta modelo en el período.
        </p>
      )}
    </div>
  )
}
