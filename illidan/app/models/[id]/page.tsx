import Link from "next/link"
import { notFound } from "next/navigation"
import { apiFetchPublic, ApiError } from "@/lib/api"
import type { Model } from "@/lib/types"
import { buttonVariants } from "@/components/ui/button"

export const revalidate = 3600

export async function generateStaticParams() {
  try {
    const models = await apiFetchPublic<Model[]>("/models")
    return models.map((m) => ({ id: m.id }))
  } catch {
    return []
  }
}

async function getModel(id: string): Promise<Model | null> {
  try {
    return await apiFetchPublic<Model>(`/models/${id}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`
}

function tgLink(handle: string): string {
  return `https://t.me/${handle.replace(/^@/, "")}`
}

export default async function ModelProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const model = await getModel(id)
  if (!model) notFound()

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Volver
      </Link>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{model.name}</h1>
          {model.description && (
            <p className="mt-2 text-muted-foreground">{model.description}</p>
          )}
        </div>

        {(model.phone || model.telegram) && (
          <div className="flex flex-wrap gap-3">
            {model.phone && (
              <a
                href={waLink(model.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants()}
              >
                WhatsApp
              </a>
            )}
            {model.telegram && (
              <a
                href={tgLink(model.telegram)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                Telegram
              </a>
            )}
          </div>
        )}

        {model.images.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {model.images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.url}
                alt={model.name}
                className="aspect-[3/4] w-full rounded-lg object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Sin fotos disponibles.</p>
        )}
      </div>
    </main>
  )
}
