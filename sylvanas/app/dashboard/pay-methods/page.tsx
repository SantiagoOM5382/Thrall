import { apiFetch } from "@/lib/api"
import { PaidGate } from "@/components/shared/PaidGate"
import { getSubscription } from "@/lib/subscription-server"
import { UpsellCard } from "@/components/shared/UpsellCard"
import type { PayMethod } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PayMethodFormDialog } from "./pay-method-form-dialog"
import { DeletePayMethodButton } from "./delete-pay-method-button"

export const dynamic = "force-dynamic"

export default async function PayMethodsPage() {
  const sub = await getSubscription()
  if (!sub.isPaidEffective) {
    return <UpsellCard reason={sub.status === "expired" ? "trial_expired" : "free"} />
  }

  const methods = await apiFetch<PayMethod[]>("/pay-methods")

  return (
    <PaidGate>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Métodos de pago
        </h1>
        <PayMethodFormDialog mode="create" />
      </div>

      {methods.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No hay métodos de pago registrados.
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.code}</TableCell>
                  <TableCell>{m.displayName ?? "—"}</TableCell>
                  <TableCell>
                    {m.isActive === 1 ? (
                      <Badge>Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <PayMethodFormDialog
                      mode="edit"
                      initial={{
                        id: m.id,
                        code: m.code,
                        displayName: m.displayName ?? "",
                      }}
                    />
                    <DeletePayMethodButton id={m.id} code={m.code} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
    </PaidGate>
  )
}
