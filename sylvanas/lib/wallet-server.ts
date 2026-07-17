import { apiFetch } from "@/lib/api"
import type { WalletState } from "@/lib/wallet-context"
import { DEFAULT_WALLET_STATE } from "@/lib/wallet-context"

/**
 * Server-side wallet lookup. Falls back to the default (0 balance) state on
 * any error rather than throwing — same reasoning as getSubscription().
 */
export async function getWallet(): Promise<WalletState> {
  try {
    return await apiFetch<WalletState>("/brand/wallet")
  } catch {
    return DEFAULT_WALLET_STATE
  }
}
