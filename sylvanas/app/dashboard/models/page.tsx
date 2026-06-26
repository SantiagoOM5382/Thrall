import Link from "next/link"
import { apiFetch } from "@/lib/api"
import type { Model } from "@/lib/types"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

type UserRow = Omit<Model, "images">

function statusBadge(u: UserRow) {
  if (u.deletedAt !== null)
    return <Badge variant="destructive">Eliminado</Badge>
  if (u.isActive === 0) return <Badge variant="secondary">Inactivo</Badge>
  return <Badge>Activo</Badge>
}

export default async function ModelsPage() {
  const all = await apiFetch<UserRow[]>("/users")
  const models = all.filter((u) => u.role === "model")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Modelos</h1>

      {models.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No hay modelos registradas.
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((m) => (
                <TableRow
                  key={m.id}
                  className={cn(m.deletedAt !== null && "bg-destructive/10")}
                >
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>{m.phone ?? "—"}</TableCell>
                  <TableCell>{m.telegram ?? "—"}</TableCell>
                  <TableCell>{statusBadge(m)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/models/${m.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Ver
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
