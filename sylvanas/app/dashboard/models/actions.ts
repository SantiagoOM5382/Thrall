"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { apiFetch } from "@/lib/api"

const COOKIE_NAME = "arthas_token"

export async function uploadModelImage(
  userId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const file = formData.get("file")
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Selecciona una imagen" }
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value
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

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error ?? "Error al subir la imagen" }
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
