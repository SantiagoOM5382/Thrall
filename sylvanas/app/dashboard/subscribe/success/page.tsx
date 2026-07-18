"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, CheckCircle2, XCircle, Clock, type LucideIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Latest = null | {
  id: string
  productCode: string
  amountCop: number
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
  wompiReference: string
  paidAt: number | null
  createdAt: number
}

type UiState = 'polling' | 'approved' | 'declined' | 'timeout'

export default function SuccessPage() {
  const [state, setState] = useState<UiState>('polling')

  useEffect(() => {
    let cancelled = false
    const started = Date.now()
    const TIMEOUT_MS = 30_000
    const INTERVAL_MS = 2_000

    async function tick() {
      if (cancelled) return
      try {
        const res = await fetch('/api/brand-purchases-latest', { cache: 'no-store' })
        const body = await res.json() as { latest: Latest }
        const s = body.latest?.status
        if (s === 'APPROVED') { setState('approved'); return }
        if (s === 'DECLINED' || s === 'VOIDED' || s === 'ERROR') { setState('declined'); return }
      } catch { /* keep polling */ }
      if (Date.now() - started > TIMEOUT_MS) { setState('timeout'); return }
      setTimeout(tick, INTERVAL_MS)
    }
    tick()
    return () => { cancelled = true }
  }, [])

  const card = 'mx-auto max-w-md mt-16 rounded-xl border p-8 text-center'

  const CONTENT: Record<UiState, { icon: LucideIcon; tone: string; title: string; body: string; cta: { href: string; label: string } | null }> = {
    polling: {
      icon: Loader2,
      tone: "bg-muted text-muted-foreground",
      title: "Confirmando tu pago",
      body: "Estamos verificando el pago con Wompi. Esto no debería tardar más de unos segundos.",
      cta: null,
    },
    approved: {
      icon: CheckCircle2,
      tone: "bg-positive/15 text-positive",
      title: "¡Pago aprobado!",
      body: "Tu compra ya está activa.",
      cta: { href: "/dashboard", label: "Ir al dashboard" },
    },
    declined: {
      icon: XCircle,
      tone: "bg-destructive/15 text-destructive",
      title: "El pago no se completó",
      body: "Wompi rechazó o canceló la transacción. No se te realizó ningún cobro.",
      cta: { href: "/dashboard/subscribe", label: "Intentar de nuevo" },
    },
    timeout: {
      icon: Clock,
      tone: "bg-accent text-accent-foreground",
      title: "Wompi sigue procesando",
      body: "Puede tardar unos minutos más en confirmarse. Te avisaremos apenas esté listo — no es necesario que esperes aquí.",
      cta: { href: "/dashboard", label: "Ir al dashboard" },
    },
  }

  const { icon: Icon, tone, title, body, cta } = CONTENT[state]

  return (
    <div className={card}>
      <span className={cn("mx-auto flex size-14 items-center justify-center rounded-full", tone)}>
        <Icon className={cn("size-6", state === "polling" && "animate-spin")} />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{body}</p>
      {state === "polling" && (
        <div className="mt-4 h-1 w-full overflow-hidden rounded bg-muted">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      )}
      {cta && (
        <Link href={cta.href} className={cn(buttonVariants(), "mt-5")}>
          {cta.label}
        </Link>
      )}
    </div>
  )
}
