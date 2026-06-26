"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export interface MovementInput {
  modelId: string
  amount: number
  reason: string
}

export async function createFine(data: MovementInput): Promise<{ error?: string }> {
  try {
    await apiFetch("/fines", { method: "POST", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear multa" }
  }
  revalidatePath("/dashboard/services")
  return {}
}

export async function createLoan(data: MovementInput): Promise<{ error?: string }> {
  try {
    await apiFetch("/loans", { method: "POST", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear préstamo" }
  }
  revalidatePath("/dashboard/services")
  return {}
}

export async function deleteFine(id: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/fines/${id}`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar" }
  }
  revalidatePath("/dashboard/services")
  return {}
}

export async function deleteLoan(id: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/loans/${id}`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar" }
  }
  revalidatePath("/dashboard/services")
  return {}
}
