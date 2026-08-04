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

const CREATE_ERROR_MESSAGES: Record<string, string> = {
  solo_brand_single_model:
    "Tu cuenta fue creada como modelo independiente. Solo puedes publicar tu propio perfil.",
  model_cap_reached:
    "Alcanzaste el límite de modelos del plan gratuito. Suscríbete para publicar más.",
  phone_required_for_model:
    "El teléfono es obligatorio para modelos publicadas en la vitrina.",
  subscription_required:
    "Necesitas una suscripción activa para crear administradores o monitores.",
}

export async function createUser(
  data: CreateUserInput
): Promise<{ error?: string }> {
  try {
    await apiFetch("/users", { method: "POST", body: JSON.stringify(data) })
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Error al crear usuario"
    return { error: CREATE_ERROR_MESSAGES[raw] ?? raw }
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
