export function getTodayRangeInBogota(): { start: number; end: number } {
  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  // Colombia does not observe DST; Bogota is permanently UTC-5
  const start = new Date(`${dateStr}T00:00:00-05:00`).getTime()
  const end = new Date(`${dateStr}T23:59:59.999-05:00`).getTime()
  return { start, end }
}
