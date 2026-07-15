"use client"

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from "react"

export type SubscriptionState = {
  tier: "free" | "paid"
  status: "active" | "trial" | "expired"
  trialEndsAt: number | null
  paidUntil: number | null
  isGrandfathered: boolean
  isPaidEffective: boolean
  daysLeft: number | null
}

type Ctx = SubscriptionState & { loading: boolean; refetch: () => Promise<void> }

const SubscriptionContext = createContext<Ctx | null>(null)

export const DEFAULT_SUBSCRIPTION_STATE: SubscriptionState = {
  tier: "free",
  status: "expired",
  trialEndsAt: null,
  paidUntil: null,
  isGrandfathered: false,
  isPaidEffective: false,
  daysLeft: null,
}

export function SubscriptionProvider({
  initial,
  children,
}: {
  initial: SubscriptionState
  children: ReactNode
}) {
  const [state, setState] = useState<SubscriptionState>(initial)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/brand-subscription", { cache: "no-store" })
      if (res.ok) {
        setState(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <SubscriptionContext.Provider value={{ ...state, loading, refetch }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): Ctx {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    throw new Error("useSubscription must be used inside SubscriptionProvider")
  }
  return ctx
}
