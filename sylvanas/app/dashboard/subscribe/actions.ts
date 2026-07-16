"use server"
import { apiFetch } from "@/lib/api"

export async function createCheckout(productId: string): Promise<
  { ok: true; checkoutUrl: string } | { ok: false; error: string }
> {
  try {
    const { checkoutUrl } = await apiFetch<{ checkoutUrl: string }>(
      "/brand/subscribe",
      { method: "POST", body: JSON.stringify({ productId }) },
    )
    return { ok: true, checkoutUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error"
    return { ok: false, error: msg }
  }
}
