import Link from "next/link"
import { apiFetchPublic } from "@/lib/api"
import type { Model } from "@/lib/types"
import { ModelGrid } from "@/components/model-grid"

// Short ISR window so uploads / edits made in sylvanas propagate to visitors
// within a minute instead of the standard 1h.
export const revalidate = 60

const PAGE_SIZE = 10

interface ModelsPage {
  models: Model[]
  total: number
  limit: number
  offset: number
}

async function getPage(page: number): Promise<ModelsPage> {
  const offset = (page - 1) * PAGE_SIZE
  try {
    return await apiFetchPublic<ModelsPage>(
      `/models?limit=${PAGE_SIZE}&offset=${offset}`,
    )
  } catch {
    return { models: [], total: 0, limit: PAGE_SIZE, offset }
  }
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const requested = Number(sp.page ?? "1")
  const page = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1
  const { models, total } = await getPage(page)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="mb-10 border-b border-[var(--hair)] pb-5">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--taupe)]">
          Modelos
        </p>
      </div>

      {models.length === 0 ? (
        <p className="py-24 text-center font-display text-2xl italic text-[var(--taupe)]">
          Pronto, nuevas presencias.
        </p>
      ) : (
        <ModelGrid models={models} />
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Paginación"
          className="mt-14 flex items-center justify-between border-t border-[var(--hair)] pt-6 text-xs uppercase tracking-[0.18em]"
        >
          <PageLink page={page - 1} disabled={page <= 1}>
            ← Anterior
          </PageLink>
          <span className="text-[var(--taupe)]">
            Página {page} de {totalPages}
          </span>
          <PageLink page={page + 1} disabled={page >= totalPages}>
            Siguiente →
          </PageLink>
        </nav>
      )}
    </div>
  )
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed text-[var(--taupe)]/40" aria-disabled="true">
        {children}
      </span>
    )
  }
  return (
    <Link
      href={page === 1 ? "/" : `/?page=${page}`}
      className="text-[var(--gold)] transition-colors hover:text-[var(--ivory)]"
    >
      {children}
    </Link>
  )
}
