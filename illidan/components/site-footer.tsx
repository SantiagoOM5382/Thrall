export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-[var(--hair)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <span className="font-display text-xl tracking-[0.08em] text-[var(--ivory)]">
          Arthas
        </span>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--taupe)]">
          © {year} · Todos los derechos reservados
        </p>
      </div>
    </footer>
  )
}
