"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

async function put(path: string, body: object): Promise<{ error?: string }> {
  try {
    await apiFetch(path, { method: "PUT", body: JSON.stringify(body) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" }
  }
  revalidatePath("/dashboard/model-earnings")
  return {}
}

export async function editServiceAmount(id: string, basePrice: number) {
  return put(`/services/${id}`, { basePrice })
}
export async function editLoanAmount(id: string, amount: number) {
  return put(`/loans/${id}`, { amount })
}
export async function editFineAmount(id: string, amount: number) {
  return put(`/fines/${id}`, { amount })
}
