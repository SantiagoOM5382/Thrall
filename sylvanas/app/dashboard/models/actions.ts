"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"
import { AUTH_COOKIE_NAME } from "@/lib/cookies"

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

  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value

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

export async function uploadModelPreview(
  userId: string,
  formData: FormData,
): Promise<{ error?: string; previewUrl?: string }> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo (mp4, webm o gif)" }
  }
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(
    `${process.env.THRALL_URL}/api/images/users/${userId}/preview`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
      cache: "no-store",
    },
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const map: Record<string, string> = {
      invalid_type: "Solo se aceptan MP4, WebM o GIF",
      file_too_large: "El archivo excede el tamaño máximo (15 MB)",
      preview_only_for_models: "Solo se puede subir preview a modelos",
    }
    return { error: map[body.error] ?? body.error ?? "No se pudo subir el preview" }
  }
  revalidatePath(`/dashboard/models/${userId}`)
  return { previewUrl: body.previewUrl }
}

export async function deleteModelPreview(
  userId: string,
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/images/users/${userId}/preview`, { method: "DELETE" })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al eliminar preview" }
  }
  revalidatePath(`/dashboard/models/${userId}`)
  return {}
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
