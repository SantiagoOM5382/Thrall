import Link from "next/link"
import { Users as UsersIcon, ArrowRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { getSession } from "@/lib/session"
import type { User, Role } from "@/lib/types"
import { cn } from "@/lib/utils"
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
import { CreateUserDialog } from "./create-user-dialog"
import { DeleteUserButton } from "./delete-user-button"

export const dynamic = "force-dynamic"

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  monitor: "Monitor",
  model: "Modelo",
  dev: "Dev",
}

const ROLE_BADGE_CLASS: Record<Role, string> = {
  admin: "bg-primary/15 text-primary",
  monitor: "bg-chart-3/15 text-chart-3",
  model: "bg-chart-5/15 text-chart-5",
  dev: "bg-muted text-muted-foreground",
}

const FILTERS: { key: string; label: string; role?: Role }[] = [
  { key: "all", label: "Todos" },
  { key: "model", label: "Modelos", role: "model" },
  { key: "monitor", label: "Monitores", role: "monitor" },
  { key: "admin", label: "Admins", role: "admin" },
]

function statusBadge(u: User) {
  if (u.deletedAt !== null) return <Badge variant="destructive">Eliminado</Badge>
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

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>
}) {
  const { role } = await searchParams
  const session = await getSession()
  const all = await apiFetch<User[]>("/users")
  const filtered =
    role && role !== "all" ? all.filter((u) => u.role === role) : all

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <CreateUserDialog />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (role ?? "all") === f.key
          const count = f.role ? all.filter((u) => u.role === f.role).length : all.length
          return (
            <Link
              key={f.key}
              href={`/dashboard/users?role=${f.key}`}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-primary-foreground/20" : "bg-foreground/10"
                )}
              >
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UsersIcon className="size-5" />
          </span>
          <p className="text-muted-foreground">No hay usuarios en esta vista.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow
                  key={u.id}
                  className={cn(u.deletedAt !== null && "bg-destructive/10")}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {initials(u.name)}
                      </span>
                      {u.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_BADGE_CLASS[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  </TableCell>
                  <TableCell>{statusBadge(u)}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    {u.role === "model" && (
                      <Link
                        href={`/dashboard/models/${u.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
                      >
                        Ver
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                    {u.id !== session?.sub && u.deletedAt === null && (
                      <DeleteUserButton id={u.id} name={u.name} />
                    )}
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
