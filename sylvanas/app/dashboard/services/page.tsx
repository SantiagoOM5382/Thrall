import Link from "next/link"
import { apiFetch } from "@/lib/api"
import type { Service, Model, PayMethod, Fine, Loan } from "@/lib/types"
import {
  formatCOP,
  formatDuration,
  formatBogotaDate,
  calcEarnings,
  cn,
  todayBogota,
  bogotaDayKey,
} from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DeleteServiceButton } from "./delete-service-button"
import { RegisterMovementDialog } from "./register-movement-dialog"
import { DeleteMovementButton } from "./delete-movement-button"
import { DayPicker } from "./day-picker"
import { EditableBase } from "./editable-base"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

async function loadData() {
  const [services, models, payMethods, fines, loans] = await Promise.all([
    apiFetch<Service[]>("/services"),
    apiFetch<Model[]>("/models"),
    apiFetch<PayMethod[]>("/pay-methods"),
    apiFetch<Fine[]>("/fines"),
    apiFetch<Loan[]>("/loans"),
  ])
  return { services, models, payMethods, fines, loans }
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const {
    services: allServices,
    models,
    payMethods,
    fines: allFines,
    loans: allLoans,
  } = await loadData()
  const session = await getSession()
  const isAdmin = session?.role === "admin"
  const isAdminOrMonitor = session?.role === "admin" || session?.role === "monitor"

  // Day filter: default today (Bogota). Admin receives all history, so filter
  // client-side; monitor only receives today's data from the backend anyway.
  const sp = await searchParams
  const selectedDay = sp.date ?? todayBogota()
  const services = allServices.filter(
    (s) => bogotaDayKey(s.startTime) === selectedDay
  )
  const fines = allFines.filter((f) => bogotaDayKey(f.createdAt) === selectedDay)
  const loans = allLoans.filter((l) => bogotaDayKey(l.createdAt) === selectedDay)

  const modelName = new Map(models.map((m) => [m.id, m.name]))
  const payCode = new Map(payMethods.map((p) => [p.id, p.code]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Servicios del día
        </h1>
        <div className="flex items-center gap-2">
          {isAdmin && <DayPicker value={selectedDay} />}
          {isAdminOrMonitor && (
            <>
              <RegisterMovementDialog kind="fine" models={models.map((m) => ({ id: m.id, name: m.name }))} />
              <RegisterMovementDialog kind="loan" models={models.map((m) => ({ id: m.id, name: m.name }))} />
            </>
          )}
          <Link href="/dashboard/services/new" className={buttonVariants()}>
            Nuevo servicio
          </Link>
        </div>
      </div>

      {services.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No hay servicios registrados en este día.
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Extras</TableHead>
                <TableHead className="text-right">Total modelo</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => {
                const earnings = calcEarnings(
                  s.basePrice,
                  s.extras.map((e) => e.amount)
                )
                const deleted = s.deletedAt !== null
                const timeOpts: Intl.DateTimeFormatOptions = {
                  hour: "2-digit",
                  minute: "2-digit",
                }
                return (
                  <TableRow
                    key={s.id}
                    className={cn(deleted && "bg-destructive/10")}
                  >
                    <TableCell>{formatBogotaDate(s.startTime, timeOpts)}</TableCell>
                    <TableCell>{formatBogotaDate(s.endTime, timeOpts)}</TableCell>
                    <TableCell>{formatDuration(s.startTime, s.endTime)}</TableCell>
                    <TableCell>
                      {modelName.get(s.modelId) ?? s.modelId}
                      {deleted && (
                        <Badge variant="destructive" className="ml-2">
                          Eliminado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {deleted ? (
                        formatCOP(s.basePrice)
                      ) : (
                        <EditableBase id={s.id} value={s.basePrice} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.extras.length > 0 ? formatCOP(earnings.modelExtras) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCOP(earnings.modelTotal)}
                    </TableCell>
                    <TableCell>{payCode.get(s.payMethodId) ?? "—"}</TableCell>
                    <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                      {s.note ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!deleted && <DeleteServiceButton id={s.id} />}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {fines.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Multas del día</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fines.map((f) => (
                  <TableRow key={f.id} className={cn(f.deletedAt !== null && "bg-muted opacity-60")}>
                    <TableCell>{formatBogotaDate(f.createdAt, { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>{modelName.get(f.modelId) ?? f.modelId}</TableCell>
                    <TableCell className="text-right">{formatCOP(f.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{f.reason}</TableCell>
                    <TableCell className="text-right">
                      {isAdmin && f.deletedAt === null && <DeleteMovementButton kind="fine" id={f.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {loans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Préstamos del día</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id} className={cn(l.deletedAt !== null && "bg-muted opacity-60")}>
                    <TableCell>{formatBogotaDate(l.createdAt, { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>{modelName.get(l.modelId) ?? l.modelId}</TableCell>
                    <TableCell className="text-right">{formatCOP(l.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{l.reason}</TableCell>
                    <TableCell className="text-right">
                      {isAdminOrMonitor && l.deletedAt === null && <DeleteMovementButton kind="loan" id={l.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  )
}
