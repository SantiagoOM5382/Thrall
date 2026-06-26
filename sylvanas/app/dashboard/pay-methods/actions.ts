"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export interface PayMethodInput {
  code: string
  displayName: string
}

export async function createPayMethod(
  data: PayMethodInput
): Promise<{ error?: string }> {
  try {
    await apiFetch("/pay-methods", { method: "POST", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear" }
  }
  revalidatePath("/dashboard/pay-methods")
  return {}
}

export async function updatePayMethod(
  id: string,
  data: PayMethodInput
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/pay-methods/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al actualizar" }
  }
  revalidatePath("/dashboard/pay-methods")
  return {}
}

export async function deletePayMethod(
  id: string
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/pay-methods/${id}`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar" }
  }
  revalidatePath("/dashboard/pay-methods")
  return {}
}
