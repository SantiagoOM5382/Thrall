"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export async function editServiceBase(
  id: string,
  basePrice: number
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/services/${id}`, {
      method: "PUT",
      body: JSON.stringify({ basePrice }),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" }
  }
  revalidatePath("/dashboard/services")
  return {}
}
