"use client"

import { Clock, AlertTriangle } from "lucide-react"
import { useSubscription } from "@/lib/subscription-context"
import { cn } from "@/lib/utils"

type Tone = "notice" | "urgent"

const TONE_STYLES: Record<Tone, string> = {
  notice: "bg-accent text-accent-foreground",
  urgent: "bg-destructive/10 text-destructive",
}

function Banner({
  tone,
  message,
  cta,
}: {
  tone: Tone
  message: string
  cta: string
}) {
  const Icon = tone === "notice" ? Clock : AlertTriangle
  return (
    <div className={cn("flex items-center justify-center gap-2 px-4 py-2 text-sm", TONE_STYLES[tone])}>
      <Icon className="size-3.5 shrink-0" />
      <span>{message}</span>
      <a
        href="/dashboard/subscribe"
        className={cn(
          "ml-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
          tone === "notice"
            ? "bg-accent-foreground/10 hover:bg-accent-foreground/15"
            : "bg-destructive/15 hover:bg-destructive/25"
        )}
      >
        {cta}
      </a>
    </div>
  )
}

/**
 * Dashboard-shell banner nudging brands toward a paid subscription. Hidden
 * entirely for grandfathered brands; "notice" tone (soft gold, matches the
 * app's accent token) while a trial/plan is still active but ending soon,
 * "urgent" tone (destructive token) once trial/paid access has lapsed.
 */
export function TrialBanner() {
  const s = useSubscription()
  if (s.loading) return null
  if (s.isGrandfathered) return null

  if (s.status === "trial" && s.isPaidEffective) {
    return (
      <Banner
        tone="notice"
        message={`Tu prueba termina en ${s.daysLeft} día${s.daysLeft === 1 ? "" : "s"}.`}
        cta="Suscribirse"
      />
    )
  }

  if (!s.isPaidEffective && s.tier === "free") {
    return (
      <Banner
        tone="urgent"
        message="Tu prueba terminó — algunas funciones están bloqueadas."
        cta="Suscribirse"
      />
    )
  }

  if (s.tier === "paid" && s.status === "active" && s.daysLeft !== null && s.daysLeft > 0 && s.daysLeft <= 5) {
    return (
      <Banner
        tone="notice"
        message={`Tu plan vence en ${s.daysLeft} día${s.daysLeft === 1 ? "" : "s"}.`}
        cta="Renovar"
      />
    )
  }

  if (s.tier === "paid" && !s.isPaidEffective) {
    return (
      <Banner
        tone="urgent"
        message="Tu plan venció — algunas funciones están bloqueadas."
        cta="Renovar"
      />
    )
  }

  return null
}
