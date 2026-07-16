"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarClock,
  Trophy,
  Building2,
  Wallet,
  Users,
  Sparkles,
  CreditCard,
  UserCircle,
  LogOut,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react"
import { useSession } from "@/components/session-provider"
import { useSubscription } from "@/lib/subscription-context"
import { logout } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { Role } from "@/lib/types"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: Role[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Grouped so the rail reads by job, not as a flat list: what happens on the
// floor (Operación), where the money lands (Finanzas), and who/what is managed
// (Administración). The model role only ever sees its own profile.
const GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { href: "/dashboard/services", label: "Servicios", icon: CalendarClock, roles: ["admin", "monitor"] },
      { href: "/dashboard/ranking", label: "Ranking", icon: Trophy, roles: ["admin", "monitor"] },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/dashboard/earnings", label: "Ganancias empresa", icon: Building2, roles: ["admin"] },
      { href: "/dashboard/model-earnings", label: "Ganancias por modelo", icon: Wallet, roles: ["admin"] },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/dashboard/users", label: "Usuarios", icon: Users, roles: ["admin"] },
      { href: "/dashboard/models", label: "Modelos", icon: Sparkles, roles: ["admin"] },
      { href: "/dashboard/pay-methods", label: "Métodos de pago", icon: CreditCard, roles: ["admin"] },
    ],
  },
  {
    label: "Mi cuenta",
    items: [
      { href: "/dashboard/profile", label: "Mi perfil", icon: UserCircle, roles: ["model"] },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { href: "/dashboard/brands", label: "Brands", icon: LayoutGrid, roles: ["dev"] },
      { href: "/dashboard/brand-earnings", label: "Ingresos por brand", icon: Building2, roles: ["dev"] },
    ],
  },
]

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  monitor: "Monitor",
  model: "Modelo",
  dev: "Dev",
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Arthas"

// Gated sections: locked behind a paid subscription. Shown with a 🔒 while
// on the free tier / expired trial. brand-earnings is dev-only and bypasses
// gating entirely, so it's intentionally excluded here.
const GATED = new Set([
  "/dashboard/services",
  "/dashboard/pay-methods",
  "/dashboard/earnings",
  "/dashboard/model-earnings",
  "/dashboard/ranking",
])

export function Sidebar() {
  const user = useSession()
  const sub = useSubscription()
  const pathname = usePathname()

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.roles.includes(user.role)),
  })).filter((g) => g.items.length > 0)

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary font-heading text-sm font-bold text-sidebar-primary-foreground">
          {APP_NAME[0]}
        </span>
        <span className="font-heading text-lg font-semibold tracking-tight">
          {APP_NAME}
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              const locked = GATED.has(item.href) && !sub.isPaidEffective
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md py-2 pl-3 pr-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  {/* Gold active rail — the signature marker of "where you are". */}
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary transition-opacity",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Icon
                    className={cn(
                      "size-[1.05rem] shrink-0 transition-colors",
                      active
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                    )}
                  />
                  {item.label}
                  {locked && (
                    <span className="ml-1 opacity-60" aria-label="Requiere suscripción">
                      🔒
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/50">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </form>
      </div>
    </aside>
  )
}
