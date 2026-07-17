"use server"
import { apiFetch } from "@/lib/api"

export async function purchaseTokens(productId: string): Promise<
  { ok: true; checkoutUrl: string } | { ok: false; error: string }
> {
  try {
    const { checkoutUrl } = await apiFetch<{ checkoutUrl: string }>(
      "/brand/purchase-tokens",
      { method: "POST", body: JSON.stringify({ productId }) },
    )
    return { ok: true, checkoutUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, error: msg }
  }
}
