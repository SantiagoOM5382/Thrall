"use client"

import { useSubscription } from "@/lib/subscription-context"

/**
 * Dashboard-shell banner nudging brands toward a paid subscription. Hidden
 * entirely for grandfathered brands; amber while a trial is still active,
 * red once trial/paid access has lapsed and the brand is back on the free
 * tier with reduced functionality.
 */
export function TrialBanner() {
  const s = useSubscription()
  if (s.loading) return null
  if (s.isGrandfathered) return null

  if (s.status === "trial" && s.isPaidEffective) {
    return (
      <div className="flex items-center justify-between gap-4 bg-amber-100 px-4 py-2 text-sm text-amber-900">
        <span>
          Trial: {s.daysLeft} día{s.daysLeft === 1 ? "" : "s"} restantes.
        </span>
        <a href="/dashboard/subscribe" className="font-medium underline">
          Suscribirse
        </a>
      </div>
    )
  }

  if (!s.isPaidEffective && s.tier === "free") {
    return (
      <div className="flex items-center justify-between gap-4 bg-red-100 px-4 py-2 text-sm text-red-900">
        <span>Tu trial terminó. Muchas funciones están bloqueadas.</span>
        <a href="/dashboard/subscribe" className="font-medium underline">
          Suscríbete para recuperarlas
        </a>
      </div>
    )
  }

  if (s.tier === "paid" && s.status === "active" && s.daysLeft !== null && s.daysLeft > 0 && s.daysLeft <= 5) {
    return (
      <div className="flex items-center justify-between gap-4 bg-amber-100 px-4 py-2 text-sm text-amber-900">
        <span>Tu plan vence en {s.daysLeft} día{s.daysLeft === 1 ? "" : "s"}.</span>
        <a href="/dashboard/subscribe" className="font-medium underline">
          Renovar
        </a>
      </div>
    )
  }

  if (s.tier === "paid" && !s.isPaidEffective) {
    return (
      <div className="flex items-center justify-between gap-4 bg-red-100 px-4 py-2 text-sm text-red-900">
        <span>Tu plan venció. Muchas funciones están bloqueadas.</span>
        <a href="/dashboard/subscribe" className="font-medium underline">
          Renovar
        </a>
      </div>
    )
  }

  return null
}
