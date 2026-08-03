import Link from "next/link"

// Both CTAs land on the same sylvanas deployment. NEXT_PUBLIC_DASHBOARD_URL
// is legacy; NEXT_PUBLIC_SYLVANAS_URL is the canonical one and takes precedence.
// If neither is set (misconfigured deploy) links fall back to "#" so we don't
// send the user to some other origin.
const SYLVANAS_URL =
  process.env.NEXT_PUBLIC_SYLVANAS_URL ??
  process.env.NEXT_PUBLIC_DASHBOARD_URL ??
  "#"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hair)] bg-[var(--espresso)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl font-medium tracking-[0.08em] text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
        >
          Musa
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
            href={SYLVANAS_URL === "#" ? "#" : `${SYLVANAS_URL}/login`}
            className="rounded-full border border-[var(--gold)]/50 px-5 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[var(--espresso)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Ingresar
          </a>
        </div>
      </div>
    </header>
  )
}
