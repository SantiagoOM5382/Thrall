import Link from "next/link"
import { notFound } from "next/navigation"
import { apiFetch, ApiError } from "@/lib/api"
import type { Model, PayMethod, Fine, Loan, Payment, ModelBalance } from "@/lib/types"
import { formatCOP, formatBogotaDate, cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ImageUploader } from "./image-uploader"
import { DeleteImageButton } from "./delete-image-button"
import { PaymentDialog } from "./payment-dialog"

export const dynamic = "force-dynamic"

type UserRow = Omit<Model, "images">

async function getModelImages(id: string): Promise<Model["images"]> {
  try {
    const m = await apiFetch<Model>(`/models/${id}`)
    return m.images
  } catch (e) {
    // Inactive/non-model users have no public /models entry.
    if (e instanceof ApiError && e.status === 404) return []
    throw e
  }
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let user: UserRow
  try {
    user = await apiFetch<UserRow>(`/users/${id}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound()
    throw e
  }

  const [images, balance, allPayments, allFines, allLoans, payMethods] =
    await Promise.all([
      getModelImages(id),
      apiFetch<ModelBalance>(`/reports/model-balance/${id}`),
      apiFetch<Payment[]>(`/payments?modelId=${id}`),
      apiFetch<Fine[]>("/fines"),
      apiFetch<Loan[]>("/loans"),
      apiFetch<PayMethod[]>("/pay-methods"),
    ])

  const payments = allPayments.filter((p) => p.modelId === id)
  const fines = allFines.filter((f) => f.modelId === id && !f.deletedAt)
  const loans = allLoans.filter((l) => l.modelId === id && !l.deletedAt)

  const payOptions = payMethods.map((p) => ({
    id: p.id,
    label: p.displayName ? `${p.code} — ${p.displayName}` : p.code,
  }))
  const payCode = new Map(payMethods.map((p) => [p.id, p.displayName ? `${p.code} — ${p.displayName}` : p.code]))

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/models"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver a modelos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {user.name}
        </h1>
      </div>

      <section className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Correo: </span>
          {user.email}
        </div>
        <div>
          <span className="text-muted-foreground">Teléfono: </span>
          {user.phone ?? "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Telegram: </span>
          {user.telegram ?? "—"}
        </div>
        <div className="sm:col-span-2">
          <span className="text-muted-foreground">Descripción: </span>
          {user.description ?? "—"}
        </div>
      </section>

      {/* Balance card */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Saldo y pagos</h2>
        <Card>
          <CardContent className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground">Saldo actual</p>
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
              <PaymentDialog modelId={id} currentBalance={balance.balance} payMethods={payOptions} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Payment history */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Historial de pagos</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
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
        )}
      </section>

      {/* Fines */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Multas</h2>
        {fines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin multas activas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fines.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{formatBogotaDate(f.createdAt)}</TableCell>
                  <TableCell>{formatCOP(f.amount)}</TableCell>
                  <TableCell>{f.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Loans */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Préstamos</h2>
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin préstamos activos.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{formatBogotaDate(l.createdAt)}</TableCell>
                  <TableCell>{formatCOP(l.amount)}</TableCell>
                  <TableCell>{l.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Gallery */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Galería</h2>
        <ImageUploader userId={id} />

        {images.length === 0 ? (
          <p className="text-muted-foreground">Sin imágenes.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={user.name}
                  className="aspect-[3/4] w-full rounded-lg object-cover"
                />
                <DeleteImageButton imageId={img.id} userId={id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
