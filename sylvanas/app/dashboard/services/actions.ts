"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export interface ServiceExtraInput {
  description: string
  amount: number
}

export interface CreateServiceInput {
  modelId: string
  startTime: number
  endTime: number
  basePrice: number
  payMethodId: string
  note?: string
  extras: ServiceExtraInput[]
}

export async function createService(
  data: CreateServiceInput
): Promise<{ error?: string }> {
  try {
    await apiFetch("/services", {
      method: "POST",
      body: JSON.stringify(data),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear servicio" }
  }
  revalidatePath("/dashboard/services")
  return {}
}

export async function deleteService(
  id: string
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/services/${id}`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar" }
  }
  revalidatePath("/dashboard/services")
  return {}
}
