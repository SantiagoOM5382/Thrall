import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, UserCircle, Images } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api"
import type { Model, User } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImageUploader } from "./image-uploader"
import { DeleteImageButton } from "./delete-image-button"
import { ProfileEditForm } from "./profile-edit-form"
import { BoostButton } from "./boost-button"

export const dynamic = "force-dynamic"

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

async function getModelImages(id: string): Promise<Model["images"]> {
  try {
    const m = await apiFetch<Model>(`/models/${id}`)
    return m.images
  } catch (e) {
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

  let user: User
  try {
    user = await apiFetch<User>(`/users/${id}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound()
    throw e
  }

  const images = await getModelImages(id)
  const topServices = await apiFetch<{ id: string; code: string; displayName: string; tokensCost: number; durationHours: number }[]>("/top-services").catch(() => [])
  const cover = images[0]?.url

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/models"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Modelos
        </Link>

        <div className="mt-3 flex items-center gap-4">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={user.name}
              className="size-16 shrink-0 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
              {initials(user.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{user.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Destacar en la vitrina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Gasta tokens para que este perfil aparezca primero en la vitrina pública durante un tiempo.
          </p>
          <BoostButton modelId={id} services={topServices} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle className="size-4 text-muted-foreground" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileEditForm
            id={id}
            initial={{
              name: user.name,
              email: user.email,
              phone: user.phone ?? "",
              telegram: user.telegram ?? "",
              description: user.description ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Images className="size-4 text-muted-foreground" />
            Galería
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImageUploader userId={id} />
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin imágenes todavía.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {images.map((img) => (
                <div key={img.id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={user.name}
                    className="aspect-[3/4] w-full rounded-lg object-cover ring-1 ring-border"
                  />
                  <DeleteImageButton imageId={img.id} userId={id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
