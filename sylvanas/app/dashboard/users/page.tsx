import Link from "next/link"
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

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "model", label: "Modelos" },
  { key: "monitor", label: "Monitores" },
  { key: "admin", label: "Admins" },
]

function statusBadge(u: User) {
  if (u.deletedAt !== null) return <Badge variant="destructive">Eliminado</Badge>
  if (u.isActive === 0) return <Badge variant="secondary">Inactivo</Badge>
  return <Badge>Activo</Badge>
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

      <div className="flex gap-2">
        {FILTERS.map((f) => {
          const active = (role ?? "all") === f.key
          return (
            <Link
              key={f.key}
              href={`/dashboard/users?role=${f.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No hay usuarios en esta vista.
        </p>
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
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                  <TableCell>{statusBadge(u)}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    {u.role === "model" && (
                      <Link
                        href={`/dashboard/models/${u.id}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        Ver
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
