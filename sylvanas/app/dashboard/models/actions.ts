"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

const COOKIE_NAME = "arthas_token"

export async function uploadModelImage(
  userId: string,
  formData: FormData
): Promise<{ error?: string; uploaded?: number }> {
  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0)

  if (files.length === 0) {
    return { error: "Selecciona al menos una imagen" }
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value

  async function uploadOne(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch(
      `${process.env.THRALL_URL}/api/images/users/${userId}`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        cache: "no-store",
      }
    )
    if (res.ok) return null
    const body = await res.json().catch(() => ({}))
    return body.error ?? `Error al subir ${file.name}`
  }

  const results = await Promise.all(files.map(uploadOne))
  const failures = results.filter((r): r is string => r !== null)

  revalidatePath(`/dashboard/models/${userId}`)

  const uploaded = files.length - failures.length
  if (failures.length > 0) {
    return { uploaded, error: failures[0] }
  }
  return { uploaded }
}

export async function deleteModelImage(
  imageId: string,
  userId: string
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/images/${imageId}`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar" }
  }
  revalidatePath(`/dashboard/models/${userId}`)
  return {}
}

export async function boostModel(
  modelId: string,
  topServiceId: string
): Promise<{ error?: string; tokensBalance?: number; endsAt?: number }> {
  try {
    const res = await apiFetch<{ tokensBalance: number; boost: { endsAt: number } }>(
      `/models/${modelId}/boost`,
      { method: "POST", body: JSON.stringify({ topServiceId }) },
    )
    revalidatePath(`/dashboard/models/${modelId}`)
    return { tokensBalance: res.tokensBalance, endsAt: res.boost.endsAt }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo aplicar el boost" }
  }
}

export interface CreateModelInput {
  name: string
  email: string
  password: string
  phone?: string
  telegram?: string
  description?: string
}

export async function createModel(
  data: CreateModelInput
): Promise<{ error?: string }> {
  try {
    await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "model" }),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear modelo" }
  }
  revalidatePath("/dashboard/models")
  return {}
}
