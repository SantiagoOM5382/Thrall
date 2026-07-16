"use client"

import type { ReactNode } from "react"
import { useSubscription } from "@/lib/subscription-context"
import { UpsellCard } from "./UpsellCard"

export function PaidGate({ children }: { children: ReactNode }) {
  const s = useSubscription()
  if (s.loading) return null
  if (s.isPaidEffective) return <>{children}</>
  return <UpsellCard reason={s.status === "expired" ? "trial_expired" : "free"} />
}
