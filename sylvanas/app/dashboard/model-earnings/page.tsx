import { apiFetch } from "@/lib/api"
import type { Model, ModelBalance, Payment, PayMethod, Fine, Loan } from "@/lib/types"
import {
  formatCOP,
  formatBogotaDate,
  todayBogota,
  dayStartBogotaMs,
  dayEndBogotaMs,
  bogotaDayKey,
  cn,
} from "@/lib/utils"
import { DateRangePicker } from "@/components/shared/date-range-picker"
import { PaidGate } from "@/components/shared/PaidGate"
import { getSubscription } from "@/lib/subscription-server"
import { UpsellCard } from "@/components/shared/UpsellCard"
import { ModelSelect } from "./model-select"
import { PaymentDialog } from "./payment-dialog"
import { EditableAmount } from "./editable-amount"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
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
  const sub = await getSubscription()
  if (!sub.isPaidEffective) {
    return <UpsellCard reason={sub.status === "expired" ? "trial_expired" : "free"} />
  }

  const sp = await searchParams
  const models = await apiFetch<Model[]>("/brand/models")

  const today = todayBogota()
  const from = sp.from ?? today
  const to = sp.to ?? today

  let report: ModelEarningsReport | null = null
  let balance: ModelBalance | null = null
  let payments: Payment[] = []
  let payOptions: { id: string; label: string }[] = []
  let payCode = new Map<string, string>()
  let fines: Fine[] = []
  let loans: Loan[] = []
  if (sp.modelId) {
    const fromMs = dayStartBogotaMs(from)
    const toMs = dayEndBogotaMs(to)
    const [reportRes, balanceRes, paymentsRes, payMethodsRes, allFines, allLoans] =
      await Promise.all([
        apiFetch<ModelEarningsReport>(
          `/reports/model-earnings/${sp.modelId}?from=${fromMs}&to=${toMs}`
        ),
        apiFetch<ModelBalance>(`/reports/model-balance/${sp.modelId}`),
        apiFetch<Payment[]>(`/payments?modelId=${sp.modelId}`),
        apiFetch<PayMethod[]>("/pay-methods"),
        apiFetch<Fine[]>("/fines"),
        apiFetch<Loan[]>("/loans"),
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
    fines = allFines.filter(
      (f) =>
        f.modelId === sp.modelId &&
        f.deletedAt === null &&
        f.createdAt >= fromMs &&
        f.createdAt <= toMs
    )
    loans = allLoans.filter(
      (l) =>
        l.modelId === sp.modelId &&
        l.deletedAt === null &&
        l.createdAt >= fromMs &&
        l.createdAt <= toMs
    )
  }

  type DayGroup = {
    services: ModelEarningRow[]
    fines: Fine[]
    loans: Loan[]
  }
  const days = new Map<string, DayGroup>()
  function bucket(key: string): DayGroup {
    let g = days.get(key)
    if (!g) {
      g = { services: [], fines: [], loans: [] }
      days.set(key, g)
    }
    return g
  }
  if (report) {
    for (const s of report.rows) bucket(bogotaDayKey(s.startTime)).services.push(s)
  }
  for (const f of fines) bucket(bogotaDayKey(f.createdAt)).fines.push(f)
  for (const l of loans) bucket(bogotaDayKey(l.createdAt)).loans.push(l)
  const dayKeys = [...days.keys()].sort().reverse()

  return (
    <PaidGate>
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
      ) : dayKeys.length > 0 ? (
        <div className="space-y-4">
          {dayKeys.map((key) => {
            const g = days.get(key)!
            const loansTotal = g.loans.reduce((s, l) => s + l.amount, 0)
            return (
              <section key={key} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {formatBogotaDate(dayStartBogotaMs(key), { dateStyle: "full" })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {g.services.length} servicio(s) · pedido {formatCOP(loansTotal)}
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Ganancia modelo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.services.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>Servicio</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatBogotaDate(s.startTime, { hour: "2-digit", minute: "2-digit" })}
                          {s.extras.length > 0 ? ` · +${formatCOP(s.modelExtras)} extras` : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <EditableAmount kind="service" id={s.id} value={s.basePrice} />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCOP(s.modelTotal)}</TableCell>
                      </TableRow>
                    ))}
                    {g.loans.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>Préstamo</TableCell>
                        <TableCell className="text-muted-foreground">{l.reason}</TableCell>
                        <TableCell className="text-right">
                          <EditableAmount kind="loan" id={l.id} value={l.amount} />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">− {formatCOP(l.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {g.fines.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>Multa</TableCell>
                        <TableCell className="text-muted-foreground">{f.reason}</TableCell>
                        <TableCell className="text-right">
                          <EditableAmount kind="fine" id={f.id} value={f.amount} />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">− {formatCOP(f.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )
          })}
        </div>
      ) : (
        <p className="text-muted-foreground">
          No hay servicios para esta modelo en el período.
        </p>
      )}
    </div>
    </PaidGate>
  )
}
