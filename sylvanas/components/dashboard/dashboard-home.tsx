"use client"

import Link from "next/link"
import {
  CalendarClock,
  Trophy,
  Building2,
  Wallet,
  Coins,
  Users,
  Sparkles,
  CreditCard,
  Lock,
  ArrowRight,
  type LucideIcon,
} from "lucide-react"
import { useSession } from "@/components/session-provider"
import { useSubscription } from "@/lib/subscription-context"
import { useWallet } from "@/lib/wallet-context"
import { Badge } from "@/components/ui/badge"
import type { Role } from "@/lib/types"

type Section = "Operación" | "Finanzas" | "Administración"

interface Panel {
  href: string
  label: string
  description: string
  icon: LucideIcon
  roles: Role[]
  section: Section
  gated?: boolean
}

// Same href/role/gating/grouping rules as the sidebar
// (components/layout/sidebar.tsx) — this is the "what can I do here" front
// door, so it must never offer a path the sidebar wouldn't.
const PANELS: Panel[] = [
  {
    href: "/dashboard/services",
    label: "Servicios",
    description: "Registra los servicios del día: modelo, horario, precio base, extras y método de pago.",
    icon: CalendarClock,
    roles: ["admin", "monitor"],
    section: "Operación",
    gated: true,
  },
  {
    href: "/dashboard/ranking",
    label: "Ranking",
    description: "Compara el desempeño de tus modelos por cantidad de servicios e ingresos.",
    icon: Trophy,
    roles: ["admin", "monitor"],
    section: "Operación",
    gated: true,
  },
  {
    href: "/dashboard/earnings",
    label: "Ganancias empresa",
    description: "Consulta cuánto generó la agencia en un rango de fechas, desglosado por método de pago.",
    icon: Building2,
    roles: ["admin"],
    section: "Finanzas",
    gated: true,
  },
  {
    href: "/dashboard/model-earnings",
    label: "Ganancias por modelo",
    description: "Balance individual de cada modelo: ganancias, multas, préstamos y pagos realizados.",
    icon: Wallet,
    roles: ["admin"],
    section: "Finanzas",
    gated: true,
  },
  {
    href: "/dashboard/tokens",
    label: "Tokens",
    description: "Compra tokens y úsalos para destacar a tus modelos en la vitrina pública — más visibilidad, más contactos.",
    icon: Coins,
    roles: ["admin"],
    section: "Finanzas",
  },
  {
    href: "/dashboard/users",
    label: "Usuarios",
    description: "Administra los accesos de tu equipo: quién es admin, monitor o modelo.",
    icon: Users,
    roles: ["admin"],
    section: "Administración",
  },
  {
    href: "/dashboard/models",
    label: "Modelos",
    description: "Publica perfiles, sube fotos y edita la información que se muestra en la vitrina pública.",
    icon: Sparkles,
    roles: ["admin"],
    section: "Administración",
  },
  {
    href: "/dashboard/pay-methods",
    label: "Métodos de pago",
    description: "Configura las formas de pago que usas para liquidar servicios y pagos a tus modelos.",
    icon: CreditCard,
    roles: ["admin"],
    section: "Administración",
    gated: true,
  },
]

// One accent per section so the eye can group panels the same way the
// sidebar does, without repeating the section label on every card.
const SECTION_ACCENT: Record<Section, string> = {
  "Operación": "var(--chart-3)",
  "Finanzas": "var(--gold)",
  "Administración": "var(--chart-5)",
}

const SECTION_ORDER: Section[] = ["Operación", "Finanzas", "Administración"]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Buenos días"
  if (h < 19) return "Buenas tardes"
  return "Buenas noches"
}

export function DashboardHome() {
  const user = useSession()
  const sub = useSubscription()
  const wallet = useWallet()

  const bySection = SECTION_ORDER
    .map((section) => ({
      section,
      panels: PANELS.filter((p) => p.section === section && p.roles.includes(user.role)),
    }))
    .filter((s) => s.panels.length > 0)

  return (
    <div className="space-y-9">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {greeting()}, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Esto es lo que puedes hacer desde tu panel.
        </p>
      </div>

      {user.role === "admin" && (
        <div className="flex flex-wrap gap-2">
          {sub.isGrandfathered ? (
            <Badge variant="secondary">Cuenta especial — sin restricciones</Badge>
          ) : sub.isPaidEffective ? (
            <Badge variant="secondary" className="bg-positive/15 text-positive">
              {sub.status === "trial"
                ? `Prueba activa · ${sub.daysLeft ?? 0} día${sub.daysLeft === 1 ? "" : "s"} restantes`
                : "Plan activo"}
            </Badge>
          ) : (
            <Link href="/dashboard/subscribe">
              <Badge variant="destructive">Sin plan activo — suscríbete</Badge>
            </Link>
          )}
          <Link href="/dashboard/tokens">
            <Badge variant="outline" className="gap-1">
              <Coins className="size-3" />
              {wallet.tokensBalance} tokens
            </Badge>
          </Link>
        </div>
      )}

      {bySection.map(({ section, panels }) => (
        <section key={section} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {section}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {panels.map((panel) => {
              const Icon = panel.icon
              const locked = panel.gated && !sub.isPaidEffective
              const accent = SECTION_ACCENT[panel.section]
              return (
                <Link
                  key={panel.href}
                  href={panel.href}
                  className="group relative flex flex-col gap-3 rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="flex size-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `color-mix(in oklch, ${accent} 15%, transparent)`, color: accent }}
                    >
                      <Icon className="size-5" />
                    </span>
                    {locked ? (
                      <Lock className="size-4 text-muted-foreground/60" />
                    ) : (
                      <ArrowRight className="size-4 text-muted-foreground/0 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground/60" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold tracking-tight">
                      {panel.label}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {panel.description}
                    </p>
                  </div>
                  {locked && (
                    <p className="text-xs font-medium text-destructive">
                      Requiere suscripción activa
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
