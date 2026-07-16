import { apiFetch } from "@/lib/api"
import type { SubscriptionState } from "@/lib/subscription-context"
import { DEFAULT_SUBSCRIPTION_STATE } from "@/lib/subscription-context"

/**
 * Server-side subscription lookup. Falls back to the default (unpaid) state
 * on any error (401/403/404/network) rather than throwing — callers gate
 * paid content on the returned `isPaidEffective` flag before doing any
 * further data fetching, so a thrown ApiError here must never crash the
 * page.
 */
export async function getSubscription(): Promise<SubscriptionState> {
  try {
    return await apiFetch<SubscriptionState>("/brand/subscription")
  } catch {
    return DEFAULT_SUBSCRIPTION_STATE
  }
}
