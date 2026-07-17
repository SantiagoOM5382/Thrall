"use client"

import { useState } from "react"
import type { Model } from "@/lib/types"
import { ModelModal } from "@/components/model-modal"

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function ModelGrid({ models }: { models: Model[] }) {
  const [selected, setSelected] = useState<Model | null>(null)

  return (
    <>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => {
          const cover = model.images[0]?.url
          return (
            <li key={model.id}>
              <button
                type="button"
                onClick={() => setSelected(model)}
                aria-label={`Ver perfil de ${model.name}`}
                className="group block w-full text-left focus-visible:outline-none"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--surface)] ring-1 ring-[var(--hair)] transition-[box-shadow] duration-500 group-hover:ring-[var(--gold)]/40 group-focus-visible:ring-2 group-focus-visible:ring-[var(--gold)]">
                  {model.isBoosted && (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-[var(--gold)] px-3 py-1 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-[var(--espresso)]">
                      Destacada
                    </span>
                  )}
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

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-5 pt-16">
                    <p className="mb-1 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gold)] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                      Ver perfil
                    </p>
                    <h2 className="font-display text-3xl leading-none text-[var(--ivory)]">
                      {model.name}
                    </h2>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <ModelModal model={selected} onClose={() => setSelected(null)} />
    </>
  )
}
