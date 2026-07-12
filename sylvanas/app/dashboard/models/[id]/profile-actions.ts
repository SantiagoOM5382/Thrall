"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export interface ProfileInput {
  name: string
  email: string
  phone?: string
  telegram?: string
  description?: string
}

export async function updateModelProfile(
  id: string,
  data: ProfileInput
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" }
  }
  revalidatePath(`/dashboard/models/${id}`)
  return {}
}
