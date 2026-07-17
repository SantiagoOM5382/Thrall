import type { ReactNode } from "react"
import { Check } from "lucide-react"

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Arthas"

const FEATURES = [
  "10 días de prueba, acceso completo",
  "Gestión de modelos, servicios y personal",
  "Reportes de ganancias en tiempo real",
  "Sin tarjeta de crédito para empezar",
]

export function AuthShell({
  eyebrow,
  headline,
  children,
}: {
  eyebrow: string
  headline: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-screen">
      {/* Branding panel — hidden below lg, this is the "why join" pitch. */}
      <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex">
        {/* Ambient gold glow, top-right — echoes the sidebar's active rail without competing with the form. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--sidebar-primary)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--sidebar-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--sidebar-foreground) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary font-heading text-base font-bold text-sidebar-primary-foreground">
            {APP_NAME[0]}
          </span>
          <span className="font-heading text-xl font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-primary">
              {eyebrow}
            </p>
            <h1 className="font-heading text-3xl leading-[1.15] font-semibold text-balance">
              {headline}
            </h1>
          </div>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-sidebar-foreground/80">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20">
                  <Check className="size-2.5 text-sidebar-primary" strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/40">
          El panel administrativo para agencias que se toman el negocio en serio.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile-only compact brand mark, since the branding panel is hidden below lg. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary font-heading text-sm font-bold text-primary-foreground">
              {APP_NAME[0]}
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">
              {APP_NAME}
            </span>
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}
