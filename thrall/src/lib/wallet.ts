export function applyDiscount(priceCop: number, discountPercent: number | null | undefined): number {
  const pct = discountPercent ?? 0
  return Math.round(priceCop * (1 - pct / 100))
}

export function computeBoostExpiry(now: number, durationHours: number): number {
  return now + durationHours * 3_600_000
}
