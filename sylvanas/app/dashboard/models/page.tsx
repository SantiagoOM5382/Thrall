import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"
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
import { CreateModelDialog } from "./create-model-dialog"

export const dynamic = "force-dynamic"

type UserRow = Omit<Model, "images">

function statusBadge(u: UserRow) {
  if (u.deletedAt !== null)
    return <Badge variant="destructive">Eliminado</Badge>
  if (u.isActive === 0) return <Badge variant="secondary">Inactivo</Badge>
  return <Badge className="bg-positive/15 text-positive">Activo</Badge>
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export default async function ModelsPage() {
  const all = await apiFetch<UserRow[]>("/users")
  const models = all.filter((u) => u.role === "model")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Modelos</h1>
        <CreateModelDialog />
      </div>

      {models.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Sparkles className="size-5" />
          </span>
          <p className="max-w-xs text-muted-foreground">
            Todavía no tienes modelos registradas.
          </p>
        </div>
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
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {initials(m.name)}
                      </span>
                      {m.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>{m.phone ?? "—"}</TableCell>
                  <TableCell>{m.telegram ?? "—"}</TableCell>
                  <TableCell>{statusBadge(m)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/models/${m.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
                    >
                      Ver
                      <ArrowRight className="size-3.5" />
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
