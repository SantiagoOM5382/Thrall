import Link from "next/link"

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-[var(--hair)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <span className="font-display text-xl tracking-[0.08em] text-[var(--ivory)]">
            Musa
          </span>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--taupe)]">
            © {year} · Todos los derechos reservados
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs uppercase tracking-[0.16em] text-[var(--taupe)]">
          <Link href="/legal/terminos" className="transition-colors hover:text-[var(--ivory)]">
            Términos
          </Link>
          <Link href="/legal/privacidad" className="transition-colors hover:text-[var(--ivory)]">
            Privacidad
          </Link>
          <span className="text-[var(--hair)]">·</span>
          <span>Solo mayores de 18</span>
        </nav>
      </div>
    </footer>
  )
}
