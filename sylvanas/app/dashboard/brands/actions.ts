"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

export async function createBrand(name: string): Promise<{ error?: string }> {
  try {
    await apiFetch("/brands", { method: "POST", body: JSON.stringify({ name }) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear brand" }
  }
  revalidatePath("/dashboard/brands")
  return {}
}

export async function updateBrand(
  id: string,
  data: { name?: string; isActive?: number }
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/brands/${id}`, { method: "PUT", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al actualizar" }
  }
  revalidatePath("/dashboard/brands")
  return {}
}

export interface NewAdminInput {
  brandId: string
  name: string
  email: string
  password: string
}

export async function createBrandAdmin(data: NewAdminInput): Promise<{ error?: string }> {
  try {
    await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "admin" }),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear admin" }
  }
  revalidatePath("/dashboard/brands")
  return {}
}
