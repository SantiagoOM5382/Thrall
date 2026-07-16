import Link from "next/link"

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"

const SYLVANAS_URL = process.env.NEXT_PUBLIC_SYLVANAS_URL ?? "#"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hair)] bg-[var(--espresso)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl font-medium tracking-[0.08em] text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
        >
          Arthas
        </Link>

        <div className="flex items-center gap-3">
          <a
            href={
              SYLVANAS_URL === "#" ? "#" : `${SYLVANAS_URL}/signup`
            }
            className="rounded-full bg-[var(--gold)] px-5 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--espresso)] transition-colors hover:bg-[var(--gold)]/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Forma parte
          </a>

          <a
            href={`${DASHBOARD_URL}/login`}
            className="rounded-full border border-[var(--gold)]/50 px-5 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[var(--espresso)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Ingresar
          </a>
        </div>
      </div>
    </header>
  )
}
