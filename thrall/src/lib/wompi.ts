import { createHash } from 'node:crypto'

export function computeIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  secret: string,
): string {
  return createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest('hex')
}

export function buildCheckoutUrl(params: {
  publicKey: string
  integritySecret: string
  reference: string
  amountInCents: number
  currency: 'COP'
  redirectUrl: string
}): string {
  const sig = computeIntegritySignature(
    params.reference,
    params.amountInCents,
    params.currency,
    params.integritySecret,
  )
  const u = new URL('https://checkout.wompi.co/p/')
  u.searchParams.set('public-key', params.publicKey)
  u.searchParams.set('currency', params.currency)
  u.searchParams.set('amount-in-cents', String(params.amountInCents))
  u.searchParams.set('reference', params.reference)
  u.searchParams.set('redirect-url', params.redirectUrl)
  u.searchParams.set('signature:integrity', sig)
  return u.toString()
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export function verifyWebhookSignature(
  payload: {
    data: unknown
    timestamp: number
    signature: { properties: string[]; checksum: string }
  },
  eventsSecret: string,
): boolean {
  const parts: string[] = []
  for (const prop of payload.signature.properties) {
    const v = resolvePath(payload.data, prop)
    if (v === undefined || v === null) return false
    parts.push(String(v))
  }
  const raw = parts.join('') + String(payload.timestamp) + eventsSecret
  const computed = createHash('sha256').update(raw).digest('hex')
  return computed === payload.signature.checksum
}

export function computeNewPaidUntil(
  current: { paidUntil: number | null },
  product: { durationDays: number },
  now: number = Date.now(),
): number {
  const base = Math.max(now, current.paidUntil ?? 0)
  return base + product.durationDays * 86_400_000
}
