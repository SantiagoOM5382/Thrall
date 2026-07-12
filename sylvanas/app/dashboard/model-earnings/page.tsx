import { apiFetch } from "@/lib/api"
import type { Model, ModelBalance, Payment, PayMethod } from "@/lib/types"
import {
  formatCOP,
  formatDuration,
  formatBogotaDate,
  todayBogota,
  dayStartBogotaMs,
  dayEndBogotaMs,
  cn,
} from "@/lib/utils"
import { DateRangePicker } from "@/components/shared/date-range-picker"
import { ModelSelect } from "./model-select"
import { PaymentDialog } from "./payment-dialog"
import { Card, CardContent } from "@/components/ui/card"
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
  let balance: ModelBalance | null = null
  let payments: Payment[] = []
  let payOptions: { id: string; label: string }[] = []
  let payCode = new Map<string, string>()
  if (sp.modelId) {
    const fromMs = dayStartBogotaMs(from)
    const toMs = dayEndBogotaMs(to)
    const [reportRes, balanceRes, paymentsRes, payMethodsRes] = await Promise.all([
      apiFetch<ModelEarningsReport>(
        `/reports/model-earnings/${sp.modelId}?from=${fromMs}&to=${toMs}`
      ),
      apiFetch<ModelBalance>(`/reports/model-balance/${sp.modelId}`),
      apiFetch<Payment[]>(`/payments?modelId=${sp.modelId}`),
      apiFetch<PayMethod[]>("/pay-methods"),
    ])
    report = reportRes
    balance = balanceRes
    payments = paymentsRes
    payOptions = payMethodsRes.map((p) => ({
      id: p.id,
      label: p.displayName ? `${p.code} — ${p.displayName}` : p.code,
    }))
    payCode = new Map(
      payMethodsRes.map((p) => [p.id, p.displayName ? `${p.code} — ${p.displayName}` : p.code])
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

      {sp.modelId && balance && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground">Saldo a pagar</p>
            <p className={cn("text-3xl font-semibold", balance.balance < 0 && "text-destructive")}>
              {formatCOP(balance.balance)}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 text-sm sm:grid-cols-4">
              <div><span className="text-muted-foreground">Ganancias </span>{formatCOP(balance.totalEarnings)}</div>
              <div><span className="text-muted-foreground">− Multas </span>{formatCOP(balance.totalFines)}</div>
              <div><span className="text-muted-foreground">− Préstamos </span>{formatCOP(balance.totalLoans)}</div>
              <div><span className="text-muted-foreground">− Pagos </span>{formatCOP(balance.totalPayments)}</div>
            </div>
            <div className="pt-3">
              <PaymentDialog modelId={sp.modelId} currentBalance={balance.balance} payMethods={payOptions} />
            </div>
          </CardContent>
        </Card>
      )}

      {sp.modelId && payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Historial de pagos</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead><TableHead>Monto</TableHead><TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatBogotaDate(p.createdAt)}</TableCell>
                  <TableCell>{formatCOP(p.amount)}</TableCell>
                  <TableCell>{payCode.get(p.payMethodId) ?? p.payMethodId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

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
