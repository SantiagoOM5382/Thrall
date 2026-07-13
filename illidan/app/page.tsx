import { apiFetchPublic } from "@/lib/api"
import type { Model } from "@/lib/types"
import { ModelGrid } from "@/components/model-grid"

export const revalidate = 3600

async function getModels(): Promise<Model[]> {
  try {
    return await apiFetchPublic<Model[]>("/models")
  } catch {
    return []
  }
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
          {models.length} {models.length === 1 ? "modelo" : "modelos"}
        </p>
      </div>

      {models.length === 0 ? (
        <p className="py-24 text-center font-display text-2xl italic text-[var(--taupe)]">
          Pronto, nuevas presencias.
        </p>
      ) : (
        <ModelGrid models={models} />
      )}
    </div>
  )
}
