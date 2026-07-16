import Link from "next/link"

export function UpsellCard({ reason }: { reason: "trial_expired" | "free" }) {
  return (
    <div className="mx-auto max-w-xl mt-16 rounded-lg border p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">Esta sección es para suscriptores</h2>
      <p className="text-neutral-600 mb-4">
        {reason === "trial_expired"
          ? "Tu trial terminó. Suscríbete para volver a usar el sistema contable."
          : "Suscríbete para desbloquear el sistema contable completo."}
      </p>
      <ul className="text-sm text-neutral-600 mb-6 space-y-1">
        <li>Registro de servicios y extras</li>
        <li>Multas, préstamos y liquidaciones</li>
        <li>Reportes de ganancias</li>
        <li>Monitores y admins adicionales</li>
      </ul>
      <Link href="/dashboard/subscribe" className="inline-block rounded bg-black text-white px-4 py-2">
        Suscribirse
      </Link>
    </div>
  )
}
