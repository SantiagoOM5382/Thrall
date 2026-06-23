export interface EarningsResult {
  modelBase: number
  company: number
  modelExtras: number
  modelTotal: number
}

export function calcEarnings(basePrice: number, extraAmounts: number[]): EarningsResult {
  const modelBase = Math.round(basePrice * 0.6)
  const company = basePrice - modelBase
  const modelExtras = extraAmounts.reduce((sum, n) => sum + n, 0)
  return {
    modelBase,
    company,
    modelExtras,
    modelTotal: modelBase + modelExtras,
  }
}
