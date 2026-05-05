/**
 * Pure time range formatting logic extracted from EventsPage.tsx for testability.
 */

import type { Event } from '../types'

export function formatTimeRange(event: Event): string {
  const start = new Date(event.datetime)
  if (Number.isNaN(start.getTime())) return event.datetime

  const end = event.endDatetime ? new Date(event.endDatetime) : null
  const date = start.toLocaleDateString()
  const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (!end || Number.isNaN(end.getTime())) return `${date}, ${startTime}`

  const endDate = end.toLocaleDateString()
  const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return date === endDate ? `${date}, ${startTime} - ${endTime}` : `${date}, ${startTime} - ${endDate}, ${endTime}`
}
