import { describe, it, expect } from 'vitest'
import { calcEarnings } from '../../src/lib/earnings'

describe('calcEarnings', () => {
  it('splits base 60/40 with no extras', () => {
    const result = calcEarnings(100000, [])
    expect(result.modelBase).toBe(60000)
    expect(result.company).toBe(40000)
    expect(result.modelExtras).toBe(0)
    expect(result.modelTotal).toBe(60000)
  })

  it('assigns extras 100% to model', () => {
    const result = calcEarnings(100000, [20000, 15000])
    expect(result.modelExtras).toBe(35000)
    expect(result.modelTotal).toBe(95000)
    expect(result.company).toBe(40000)
  })

  it('rounds fractional cents', () => {
    const result = calcEarnings(100001, [])
    expect(result.modelBase + result.company).toBe(100001)
  })
})
