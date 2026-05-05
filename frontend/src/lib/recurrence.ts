/**
 * Pure recurrence generation logic extracted from the edge function
 * supabase/functions/committee-calendar-sync/index.ts
 * for testability in a Node.js/Vitest environment.
 */

export type Occurrence = {
  date: Date
  cancelled: boolean
  reason?: string
}

export function parseUsDateParts(value: unknown): { y: number; m: number; d: number } | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  return {
    m: Number(match[1]),
    d: Number(match[2]),
    y: Number(match[3]),
  }
}

export function dateOnlyFromParts(parts: { y: number; m: number; d: number }): Date {
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d))
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function daysBetween(a: Date, b: Date): number {
  const ms =
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
  return Math.round(ms / 86_400_000)
}

export function dateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dayNameInEventZone(date: Date, timeZone: string): string {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const anchorUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(anchorUtc).toLowerCase()
}

export function startOfWeekMondayInZone(date: Date, timeZone: string): Date {
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const idx = order.indexOf(dayNameInEventZone(date, timeZone))
  if (idx < 0) {
    const out = new Date(date)
    const day = out.getUTCDay()
    const offset = day === 0 ? -6 : 1 - day
    out.setUTCDate(out.getUTCDate() + offset)
    return out
  }
  return addDays(date, -idx)
}

function sameOrBefore(a: Date, b: Date): boolean {
  return dateKey(a) <= dateKey(b)
}

function sameOrAfter(a: Date, b: Date): boolean {
  return dateKey(a) >= dateKey(b)
}

export function generateOccurrences(acf: Record<string, unknown>, timeZone: string): Occurrence[] {
  const dateTimes = (acf.event_dates_times ?? {}) as Record<string, unknown>
  const baseParts = parseUsDateParts(dateTimes.departure_date)
  if (!baseParts) return []

  const baseDate = dateOnlyFromParts(baseParts)
  const recurrenceEnabled = acf.recurrence_enabled === true
  const recurrence = (acf.recurrence ?? {}) as Record<string, unknown>
  const repeatEvery = Math.max(Number(recurrence.repeat_every ?? '1') || 1, 1)
  const repeatType = String(recurrence.repeat_type ?? 'week').toLowerCase()
  const repeatDays = Array.isArray(recurrence.repeat_days)
    ? new Set(recurrence.repeat_days.map((d) => String(d).toLowerCase()))
    : new Set([dayNameInEventZone(baseDate, timeZone)])
  const endDate = parseUsDateParts(recurrence.end_date)
  const recurrenceEnd = recurrenceEnabled && endDate ? dateOnlyFromParts(endDate) : baseDate

  const byDate = new Map<string, Occurrence>()

  if (!recurrenceEnabled) {
    byDate.set(dateKey(baseDate), { date: baseDate, cancelled: false })
  } else if (repeatType === 'day') {
    for (let d = baseDate; sameOrBefore(d, recurrenceEnd); d = addDays(d, 1)) {
      if (daysBetween(baseDate, d) % repeatEvery === 0) {
        byDate.set(dateKey(d), { date: d, cancelled: false })
      }
    }
  } else if (repeatType === 'month') {
    for (
      let d = new Date(baseDate);
      sameOrBefore(d, recurrenceEnd);
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + repeatEvery, d.getUTCDate()))
    ) {
      byDate.set(dateKey(d), { date: d, cancelled: false })
    }
  } else {
    // week-based recurrence
    const baseWeek = startOfWeekMondayInZone(baseDate, timeZone)
    for (let d = baseDate; sameOrBefore(d, recurrenceEnd); d = addDays(d, 1)) {
      const weeksSinceStart = Math.floor(daysBetween(baseWeek, startOfWeekMondayInZone(d, timeZone)) / 7)
      if (repeatDays.has(dayNameInEventZone(d, timeZone)) && weeksSinceStart % repeatEvery === 0) {
        byDate.set(dateKey(d), { date: d, cancelled: false })
      }
    }
  }

  const exceptions = Array.isArray(acf.recurrence_exceptions) ? acf.recurrence_exceptions : []
  for (const item of exceptions) {
    const ex = item as Record<string, unknown>
    const parts = parseUsDateParts(ex.date)
    if (!parts) continue

    const d = dateOnlyFromParts(parts)
    const key = dateKey(d)
    const type = String(ex.type ?? '').toLowerCase()
    if (type === 'exclude') {
      byDate.set(key, { date: d, cancelled: true, reason: 'recurrence_exception' })
    } else if (type === 'include') {
      byDate.set(key, { date: d, cancelled: false, reason: 'recurrence_exception' })
    }
  }

  return [...byDate.values()].sort((a, b) => daysBetween(a.date, b.date))
}

/**
 * Filters occurrences to those within the given window bounds (inclusive).
 */
export function filterOccurrencesInWindow(
  occurrences: Occurrence[],
  windowStart: Date,
  windowEnd: Date,
): Occurrence[] {
  return occurrences.filter((occ) => sameOrAfter(occ.date, windowStart) && sameOrBefore(occ.date, windowEnd))
}
