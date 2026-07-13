import Link from "next/link"
import { apiFetchPublic } from "@/lib/api"
import type { Model } from "@/lib/types"

export const revalidate = 3600

async function getModels(): Promise<Model[]> {
  try {
    return await apiFetchPublic<Model[]>("/models")
  } catch {
    return []
  }
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export default async function LandingPage() {
  const models = await getModels()

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      {/* Editorial masthead — an eyebrow, not a headline */}
      <div className="mb-10 flex items-end justify-between border-b border-[var(--hair)] pb-5">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--taupe)]">
          Elenco
        </p>
        <p className="font-display text-sm italic text-[var(--taupe)]">
          {models.length}{" "}
          {models.length === 1 ? "modelo" : "modelos"}
        </p>
      </div>

      {models.length === 0 ? (
        <p className="py-24 text-center font-display text-2xl italic text-[var(--taupe)]">
          Pronto, nuevas presencias.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => {
            const cover = model.images[0]?.url
            return (
              <li key={model.id}>
                <Link
                  href={`/models/${model.id}`}
                  className="group block focus-visible:outline-none"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--surface)] ring-1 ring-[var(--hair)] transition-[box-shadow] duration-500 group-hover:ring-[var(--gold)]/40 group-focus-visible:ring-2 group-focus-visible:ring-[var(--gold)]">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={model.name}
                        className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-display text-6xl text-[var(--gold)]/40">
                          {initials(model.name)}
                        </span>
                      </div>
                    )}

                    {/* Scrim + name overlay — the signature treatment */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-5 pt-16">
                      <p className="mb-1 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gold)] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                        Ver perfil
                      </p>
                      <h2 className="font-display text-3xl leading-none text-[var(--ivory)]">
                        {model.name}
                      </h2>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
