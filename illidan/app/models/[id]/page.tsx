import Link from "next/link"
import { notFound } from "next/navigation"
import { apiFetchPublic, ApiError } from "@/lib/api"
import type { Model } from "@/lib/types"

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

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.4-.1-.6.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 21.5a9.5 9.5 0 0 1-4.8-1.3l-.3-.2-3.6.9.9-3.5-.2-.4A9.5 9.5 0 1 1 12 21.5m0-21a11.5 11.5 0 0 0-9.8 17.5L.5 24l6.3-1.6A11.5 11.5 0 1 0 12 .5" />
  </svg>
)

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
