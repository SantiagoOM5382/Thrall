import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDuration(startMs: number, endMs: number): string {
  const totalMin = Math.max(0, Math.round((endMs - startMs) / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatBogotaDate(
  ms: number,
  opts?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    ...(opts ?? { dateStyle: "medium", timeStyle: "short" }),
  }).format(new Date(ms))
}

export interface EarningsResult {
  modelBase: number
  company: number
  modelExtras: number
  modelTotal: number
}

export function calcEarnings(
  basePrice: number,
  extras: number[]
): EarningsResult {
  const modelBase = Math.round(basePrice * 0.6)
  const company = basePrice - modelBase
  const modelExtras = extras.reduce((sum, n) => sum + n, 0)
  return { modelBase, company, modelExtras, modelTotal: modelBase + modelExtras }
}

/** Today's date as "YYYY-MM-DD" in America/Bogota. */
export function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date())
}

/** Start-of-day (00:00:00) for a YYYY-MM-DD date, as Unix ms at UTC-5. */
export function dayStartBogotaMs(date: string): number {
  return new Date(`${date}T00:00:00-05:00`).getTime()
}

/** End-of-day (23:59:59.999) for a YYYY-MM-DD date, as Unix ms at UTC-5. */
export function dayEndBogotaMs(date: string): number {
  return new Date(`${date}T23:59:59.999-05:00`).getTime()
}

/** "YYYY-MM-DD" day key in America/Bogota, for grouping by day. */
export function bogotaDayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(ms)
  )
}
