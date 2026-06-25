import Link from "next/link"
import { apiFetch } from "@/lib/api"
import type { Service, Model, PayMethod } from "@/lib/types"
import {
  formatCOP,
  formatDuration,
  formatBogotaDate,
  calcEarnings,
  cn,
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

export const dynamic = "force-dynamic"

async function loadData() {
  const [services, models, payMethods] = await Promise.all([
    apiFetch<Service[]>("/services"),
    apiFetch<Model[]>("/models"),
    apiFetch<PayMethod[]>("/pay-methods"),
  ])
  return { services, models, payMethods }
}

export default async function ServicesPage() {
  const { services, models, payMethods } = await loadData()
  const modelName = new Map(models.map((m) => [m.id, m.name]))
  const payCode = new Map(payMethods.map((p) => [p.id, p.code]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Servicios del día
        </h1>
        <Link href="/dashboard/services/new" className={buttonVariants()}>
          Nuevo servicio
        </Link>
      </div>

      {services.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No hay servicios registrados hoy.
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
                      {formatCOP(s.basePrice)}
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
    </div>
  )
}
