import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { apiFetch, ApiError } from "@/lib/api"
import type { Service, Model, Fine, Loan } from "@/lib/types"
import {
  formatCOP,
  formatDuration,
  formatBogotaDate,
  calcEarnings,
} from "@/lib/utils"
import { ImageUploader } from "../models/[id]/image-uploader"
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

async function getImages(id: string): Promise<Model["images"]> {
  try {
    const m = await apiFetch<Model>(`/models/${id}`)
    return m.images
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return []
    throw e
  }
}

export default async function ProfilePage() {
  const user = await getSession()
  if (!user) redirect("/login")

  const [services, images, fines, loans] = await Promise.all([
    apiFetch<Service[]>("/services"),
    getImages(user.sub),
    apiFetch<Fine[]>("/fines"),
    apiFetch<Loan[]>("/loans"),
  ])

  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  }

  const dayTotal = services.reduce((sum, s) => {
    const e = calcEarnings(
      s.basePrice,
      s.extras.map((x) => x.amount)
    )
    return sum + e.modelTotal
  }, 0)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hola, {user.name}
      </h1>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Mis servicios de hoy</h2>
        {services.length === 0 ? (
          <p className="text-muted-foreground">
            No tienes servicios registrados hoy.
          </p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Mi ganancia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => {
                  const e = calcEarnings(
                    s.basePrice,
                    s.extras.map((x) => x.amount)
                  )
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        {formatBogotaDate(s.startTime, timeOpts)}
                      </TableCell>
                      <TableCell>
                        {formatBogotaDate(s.endTime, timeOpts)}
                      </TableCell>
                      <TableCell>
                        {formatDuration(s.startTime, s.endTime)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCOP(s.basePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.extras.length > 0 ? formatCOP(e.modelExtras) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCOP(e.modelTotal)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Total del día</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCOP(dayTotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </section>

      {fines.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Mis multas de hoy</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fines.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{formatBogotaDate(f.createdAt, { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell className="text-muted-foreground">{f.reason}</TableCell>
                    <TableCell className="text-right">{formatCOP(f.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {loans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Mis préstamos de hoy</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatBogotaDate(l.createdAt, { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell className="text-muted-foreground">{l.reason}</TableCell>
                    <TableCell className="text-right">{formatCOP(l.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Mis fotos</h2>
        <ImageUploader userId={user.sub} />
        {images.length === 0 ? (
          <p className="text-muted-foreground">Aún no tienes fotos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.url}
                alt={user.name}
                className="aspect-[3/4] w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Ganancia total de hoy</p>
          <p className="text-2xl font-semibold">{formatCOP(dayTotal)}</p>
        </CardContent>
      </Card>
    </div>
  )
}
