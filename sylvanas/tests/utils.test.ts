import { describe, it, expect } from 'vitest'
import { formatCOP, formatDuration, formatBogotaDate, calcEarnings } from '@/lib/utils'

describe('formatCOP', () => {
  it('formats 60000 with thousands separator and currency symbol', () => {
    const out = formatCOP(60000)
    expect(out).toContain('60.000')
    expect(out).toContain('$')
  })

  it('formats 0', () => {
    const out = formatCOP(0)
    expect(out).toContain('0')
    expect(out).toContain('$')
  })

  it('rounds non-integer values (no fraction digits)', () => {
    const out = formatCOP(1234.56)
    // maximumFractionDigits: 0 -> rounds to 1.235
    expect(out).toContain('1.235')
    expect(out).not.toMatch(/[.,]\d{2}\b/) // no two-decimal cents
  })
})

describe('formatDuration', () => {
  const min = (n: number) => n * 60000
  it('same start and end -> 0m', () => {
    expect(formatDuration(0, 0)).toBe('0m')
  })
  it('90 minutes -> 1h 30m', () => {
    expect(formatDuration(0, min(90))).toBe('1h 30m')
  })
  it('exactly 2h -> 2h', () => {
    expect(formatDuration(0, min(120))).toBe('2h')
  })
  it('45 minutes -> 45m', () => {
    expect(formatDuration(0, min(45))).toBe('45m')
  })
  it('negative range clamps to 0m', () => {
    expect(formatDuration(min(10), 0)).toBe('0m')
  })
})

describe('calcEarnings', () => {
  it('basePrice 100000 with extras [20000, 5000]', () => {
    expect(calcEarnings(100000, [20000, 5000])).toEqual({
      modelBase: 60000,
      company: 40000,
      modelExtras: 25000,
      modelTotal: 85000,
    })
  })

  it('odd basePrice keeps integer sum (modelBase + company === basePrice)', () => {
    const r = calcEarnings(99999, [])
    expect(r.modelBase + r.company).toBe(99999)
    expect(Number.isInteger(r.modelBase)).toBe(true)
    expect(Number.isInteger(r.company)).toBe(true)
    expect(r.modelExtras).toBe(0)
    expect(r.modelTotal).toBe(r.modelBase)
  })

  it('empty extras yields zero modelExtras', () => {
    const r = calcEarnings(50000, [])
    expect(r.modelExtras).toBe(0)
    expect(r.modelTotal).toBe(r.modelBase)
  })
})

describe('formatBogotaDate', () => {
  it('renders Bogota (UTC-5) local hour for a fixed UTC timestamp', () => {
    // 2024-01-15T17:00:00Z -> 12:00 in America/Bogota (UTC-5)
    const ms = Date.UTC(2024, 0, 15, 17, 0, 0)
    const out = formatBogotaDate(ms, { hour: 'numeric', minute: '2-digit', hour12: false })
    expect(out).toContain('12')
  })

  it('uses default medium date / short time when no opts given', () => {
    const ms = Date.UTC(2024, 0, 15, 17, 0, 0)
    const out = formatBogotaDate(ms)
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })
})
