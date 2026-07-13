"use client"

import { useEffect } from "react"
import type { Model } from "@/lib/types"

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

export function ModelModal({
  model,
  onClose,
}: {
  model: Model | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!model) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [model, onClose])

  if (!model) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de ${model.name}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-4 w-full max-w-3xl rounded-lg border border-[var(--hair)] bg-[var(--surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:my-8 sm:p-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-[var(--taupe)] transition-colors hover:bg-white/5 hover:text-[var(--ivory)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          <span className="text-xl leading-none" aria-hidden="true">
            ×
          </span>
        </button>

        <p className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--gold)]">
          Perfil
        </p>
        <h2 className="font-display text-5xl leading-[0.95] text-[var(--ivory)] sm:text-6xl">
          {model.name}
        </h2>
        {model.description && (
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--taupe)]">
            {model.description}
          </p>
        )}

        {(model.phone || model.telegram) && (
          <div className="mt-6 flex flex-wrap gap-3">
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

        {model.images.length > 0 ? (
          <div className="mt-8 columns-1 gap-3 sm:columns-2 [&>*]:mb-3">
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
          <p className="mt-8 font-display text-xl italic text-[var(--taupe)]">
            Galería en camino.
          </p>
        )}
      </div>
    </div>
  )
}
