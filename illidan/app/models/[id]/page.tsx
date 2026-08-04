import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { apiFetchPublic, ApiError } from "@/lib/api"
import { waLink, tgLink } from "@/lib/contacts"
import { WhatsAppIcon } from "@/components/whatsapp-icon"
import type { Model } from "@/lib/types"

// See app/page.tsx — same short ISR window so edits propagate quickly.
export const revalidate = 60

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

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const model = await getModel(id).catch(() => null)
  if (!model) return { title: "Perfil no disponible · Musa" }
  const cover = model.images?.[0]?.url
  const description = model.description?.slice(0, 155) ?? `Conoce a ${model.name} en Musa.`
  return {
    title: `${model.name} · Musa`,
    description,
    openGraph: {
      title: `${model.name} · Musa`,
      description,
      type: "profile",
      images: cover ? [{ url: cover }] : [],
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: `${model.name} · Musa`,
      description,
      images: cover ? [cover] : [],
    },
  }
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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--taupe)] transition-colors hover:text-[var(--ivory)]"
      >
        <span aria-hidden="true">←</span> Volver al elenco
      </Link>

      <header className="mb-12 flex flex-col gap-6 border-b border-[var(--hair)] pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--gold)]">
            Perfil
          </p>
          <h1 className="font-display text-6xl leading-[0.95] text-[var(--ivory)] sm:text-7xl">
            {model.name}
          </h1>
          {model.description && (
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--taupe)]">
              {model.description}
            </p>
          )}
        </div>

        {(model.phone || model.telegram) && (
          <div className="flex shrink-0 flex-wrap gap-3">
            {model.phone && (
              <a
                href={waLink(model.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-medium text-[var(--espresso)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                <WhatsAppIcon />
                Escríbeme por WhatsApp
              </a>
            )}
            {model.telegram && (
              <a
                href={tgLink(model.telegram)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-[var(--ivory)]/25 px-6 py-2.5 text-sm text-[var(--ivory)] transition-colors hover:border-[var(--ivory)]/60"
              >
                Telegram
              </a>
            )}
          </div>
        )}
      </header>

      {model.images.length > 0 ? (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {model.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={img.url}
              alt={model.name}
              className="w-full rounded-sm object-cover ring-1 ring-[var(--hair)]"
            />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center font-display text-2xl italic text-[var(--taupe)]">
          Galería en camino.
        </p>
      )}
    </div>
  )
}
