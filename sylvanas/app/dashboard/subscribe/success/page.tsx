"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

type Latest = null | {
  id: string
  productCode: string
  amountCop: number
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
  wompiReference: string
  paidAt: number | null
  createdAt: number
}

type UiState = 'polling' | 'approved' | 'declined' | 'timeout'

export default function SuccessPage() {
  const [state, setState] = useState<UiState>('polling')

  useEffect(() => {
    let cancelled = false
    const started = Date.now()
    const TIMEOUT_MS = 30_000
    const INTERVAL_MS = 2_000

    async function tick() {
      if (cancelled) return
      try {
        const res = await fetch('/api/brand-purchases-latest', { cache: 'no-store' })
        const body = await res.json() as { latest: Latest }
        const s = body.latest?.status
        if (s === 'APPROVED') { setState('approved'); return }
        if (s === 'DECLINED' || s === 'VOIDED' || s === 'ERROR') { setState('declined'); return }
      } catch { /* keep polling */ }
      if (Date.now() - started > TIMEOUT_MS) { setState('timeout'); return }
      setTimeout(tick, INTERVAL_MS)
    }
    tick()
    return () => { cancelled = true }
  }, [])

  const card = 'mx-auto max-w-md mt-16 rounded-lg border p-8 text-center'

  if (state === 'polling') return (
    <div className={card}>
      <p className="text-neutral-600">Estamos confirmando tu pago con Wompi…</p>
      <div className="mt-4 h-1 w-full bg-neutral-200 overflow-hidden rounded"><div className="h-full w-1/3 bg-neutral-500 animate-pulse" /></div>
    </div>
  )
  if (state === 'approved') return (
    <div className={`${card} border-emerald-300 bg-emerald-50`}>
      <h2 className="text-xl font-semibold">¡Suscripción activa!</h2>
      <p className="text-neutral-700 mt-2">Tu plan ya está desbloqueado.</p>
      <Link href="/dashboard" className="mt-4 inline-block rounded bg-black text-white px-4 py-2">Ir al dashboard</Link>
    </div>
  )
  if (state === 'declined') return (
    <div className={`${card} border-red-300 bg-red-50`}>
      <h2 className="text-xl font-semibold">El pago no se completó</h2>
      <Link href="/dashboard/subscribe" className="mt-4 inline-block rounded bg-black text-white px-4 py-2">Intentar de nuevo</Link>
    </div>
  )
  return (
    <div className={`${card} border-amber-300 bg-amber-50`}>
      <h2 className="text-xl font-semibold">Wompi sigue procesando</h2>
      <p className="text-neutral-700 mt-2">Te avisaremos cuando confirme. Puedes volver al dashboard.</p>
      <Link href="/dashboard" className="mt-4 inline-block rounded bg-black text-white px-4 py-2">Ir al dashboard</Link>
    </div>
  )
}
