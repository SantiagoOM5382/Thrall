"use server"

import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"
import type { Role } from "@/lib/types"

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: Role
  phone?: string
  telegram?: string
  description?: string
}

export async function createUser(
  data: CreateUserInput
): Promise<{ error?: string }> {
  try {
    await apiFetch("/users", { method: "POST", body: JSON.stringify(data) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear usuario" }
  }
  revalidatePath("/dashboard/users")
  return {}
}

export async function deleteUser(id: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/users/${id}`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar" }
  }
  revalidatePath("/dashboard/users")
  return {}
}
