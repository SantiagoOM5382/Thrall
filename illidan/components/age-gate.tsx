"use client"

import { useEffect, useState } from "react"

const COOKIE_NAME = "musa_age_ok"
const COOKIE_MAX_AGE_DAYS = 30

// Age gate as a client-side overlay rather than middleware: SEO bots (which
// don't execute JS) still index the underlying pages, while human first-time
// visitors must confirm 18+ before the site becomes usable. The cookie is set
// after confirmation so returning visitors aren't nagged.
export function AgeGate() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const has = document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_NAME}=1`))
    if (!has) setVisible(true)
  }, [])

  function confirm() {
    const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
    document.cookie = `${COOKIE_NAME}=1; Max-Age=${maxAge}; Path=/; SameSite=Lax`
    setVisible(false)
  }

  function leave() {
    window.location.href = "https://www.google.com"
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--espresso)]/95 backdrop-blur-md px-4">
      <div className="max-w-md rounded-lg border border-[var(--hair)] bg-[var(--espresso)] p-8 text-center">
        <p className="mb-1 text-xs uppercase tracking-[0.24em] text-[var(--gold)]">
          Contenido para adultos
        </p>
        <h2 className="mb-4 font-display text-3xl text-[var(--ivory)]">
          ¿Eres mayor de 18 años?
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-[var(--taupe)]">
          Musa contiene material dirigido exclusivamente a personas mayores de edad.
          Al continuar confirmas que eres mayor de 18 años y aceptas nuestros{" "}
          <a href="/legal/terminos" className="underline hover:text-[var(--ivory)]">
            Términos
          </a>{" "}
          y{" "}
          <a href="/legal/privacidad" className="underline hover:text-[var(--ivory)]">
            Política de privacidad
          </a>
          .
        </p>
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={confirm}
            className="flex-1 rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--espresso)] transition-colors hover:bg-[var(--gold)]/85"
          >
            Sí, tengo 18+
          </button>
          <button
            type="button"
            onClick={leave}
            className="flex-1 rounded-full border border-[var(--ivory)]/25 px-6 py-3 text-sm text-[var(--ivory)] transition-colors hover:border-[var(--ivory)]/60"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}
