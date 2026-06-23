import { describe, it, expect } from 'vitest'
import { getTodayRangeInBogota } from '../../src/lib/timezone'

describe('getTodayRangeInBogota', () => {
  it('returns start and end as unix ms integers', () => {
    const { start, end } = getTodayRangeInBogota()
    expect(typeof start).toBe('number')
    expect(typeof end).toBe('number')
    expect(end).toBeGreaterThan(start)
  })

  it('range spans exactly one day (86400000 ms)', () => {
    const { start, end } = getTodayRangeInBogota()
    expect(end - start).toBe(86400000 - 1000)
  })

  it('start is midnight Bogota time', () => {
    const { start } = getTodayRangeInBogota()
    const d = new Date(start)
    const bogotaHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      hour12: false,
    }).format(d)
    expect(parseInt(bogotaHour, 10)).toBe(0)
  })
})
