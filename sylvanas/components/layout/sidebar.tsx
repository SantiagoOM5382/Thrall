"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "@/components/session-provider"
import { logout } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Role } from "@/lib/types"

interface NavItem {
  href: string
  label: string
  roles: Role[]
}

const NAV: NavItem[] = [
  { href: "/dashboard/services", label: "Servicios", roles: ["admin", "monitor"] },
  { href: "/dashboard/earnings", label: "Ganancias empresa", roles: ["admin"] },
  { href: "/dashboard/model-earnings", label: "Ganancias por modelo", roles: ["admin"] },
  { href: "/dashboard/models", label: "Modelos", roles: ["admin"] },
  { href: "/dashboard/pay-methods", label: "Métodos de pago", roles: ["admin"] },
  { href: "/dashboard/profile", label: "Mi perfil", roles: ["model"] },
  { href: "/dashboard/ranking", label: "Ranking", roles: ["admin", "monitor"] },
]

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  monitor: "Monitor",
  model: "Modelo",
}

export function Sidebar() {
  const user = useSession()
  const pathname = usePathname()
  const items = NAV.filter((item) => item.roles.includes(user.role))

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/30 p-4">
      <div className="mb-6">
        <p className="truncate font-medium">{user.name}</p>
        <Badge variant="secondary" className="mt-1">
          {ROLE_LABEL[user.role]}
        </Badge>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <form action={logout} className="mt-4">
        <Button type="submit" variant="outline" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </aside>
  )
}
