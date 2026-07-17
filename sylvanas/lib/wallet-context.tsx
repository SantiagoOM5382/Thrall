"use client"

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from "react"

export type WalletState = {
  tokensBalance: number
  tokenDiscountPercent: number
}

type Ctx = WalletState & { loading: boolean; refetch: () => Promise<void> }

const WalletContext = createContext<Ctx | null>(null)

export const DEFAULT_WALLET_STATE: WalletState = {
  tokensBalance: 0,
  tokenDiscountPercent: 0,
}

export function WalletProvider({
  initial,
  children,
}: {
  initial: WalletState
  children: ReactNode
}) {
  const [state, setState] = useState<WalletState>(initial)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/brand-wallet", { cache: "no-store" })
      if (res.ok) {
        setState(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <WalletContext.Provider value={{ ...state, loading, refetch }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): Ctx {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error("useWallet must be used inside WalletProvider")
  }
  return ctx
}
