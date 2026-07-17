import { describe, it, expect } from 'vitest'
import { applyDiscount, computeBoostExpiry } from '../../src/lib/wallet'

describe('applyDiscount', () => {
  it('applies no discount when percent is null/undefined', () => {
    expect(applyDiscount(10000, null)).toBe(10000)
    expect(applyDiscount(10000, undefined)).toBe(10000)
  })

  it('applies 20/35/60 percent discounts with rounding', () => {
    expect(applyDiscount(10000, 20)).toBe(8000)
    expect(applyDiscount(40000, 35)).toBe(26000)
    expect(applyDiscount(100000, 60)).toBe(40000)
  })

  it('rounds to the nearest peso', () => {
    expect(applyDiscount(10001, 20)).toBe(8001) // 8000.8 -> 8001
  })
})

describe('computeBoostExpiry', () => {
  it('adds durationHours in ms to now', () => {
    const now = 1_000_000_000_000
    expect(computeBoostExpiry(now, 24)).toBe(now + 24 * 3_600_000)
  })
})
