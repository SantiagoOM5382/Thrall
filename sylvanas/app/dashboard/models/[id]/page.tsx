import Link from "next/link"
import { notFound } from "next/navigation"
import { apiFetch, ApiError } from "@/lib/api"
import type { Model } from "@/lib/types"
import { ImageUploader } from "./image-uploader"
import { DeleteImageButton } from "./delete-image-button"

export const dynamic = "force-dynamic"

type UserRow = Omit<Model, "images">

async function getModelImages(id: string): Promise<Model["images"]> {
  try {
    const m = await apiFetch<Model>(`/models/${id}`)
    return m.images
  } catch (e) {
    // Inactive/non-model users have no public /models entry.
    if (e instanceof ApiError && e.status === 404) return []
    throw e
  }
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let user: UserRow
  try {
    user = await apiFetch<UserRow>(`/users/${id}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound()
    throw e
  }

  const images = await getModelImages(id)

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/models"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver a modelos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {user.name}
        </h1>
      </div>

      <section className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Correo: </span>
          {user.email}
        </div>
        <div>
          <span className="text-muted-foreground">Teléfono: </span>
          {user.phone ?? "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Telegram: </span>
          {user.telegram ?? "—"}
        </div>
        <div className="sm:col-span-2">
          <span className="text-muted-foreground">Descripción: </span>
          {user.description ?? "—"}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Galería</h2>
        <ImageUploader userId={id} />

        {images.length === 0 ? (
          <p className="text-muted-foreground">Sin imágenes.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={user.name}
                  className="aspect-[3/4] w-full rounded-lg object-cover"
                />
                <DeleteImageButton imageId={img.id} userId={id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
