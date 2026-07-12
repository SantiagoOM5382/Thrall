"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export async function createPayment(
  modelId: string,
  amount: number,
  payMethodId: string
): Promise<{ error?: string }> {
  try {
    await apiFetch("/payments", {
      method: "POST",
      body: JSON.stringify({ modelId, amount, payMethodId }),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al registrar el pago" }
  }
  revalidatePath("/dashboard/model-earnings")
  return {}
}
