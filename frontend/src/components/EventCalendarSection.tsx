import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Loading } from './Loading'
import type { Event } from '../types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildMonthDays(month: Date) {
  const first = monthStart(month)
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

function sortEvents(a: Event, b: Event) {
  return new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
}

function eventTime(event: Event) {
  const start = new Date(event.datetime)
  if (Number.isNaN(start.getTime())) return event.datetime

  const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const end = event.endDatetime ? new Date(event.endDatetime) : null
  if (!end || Number.isNaN(end.getTime())) return startTime

  const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${startTime} - ${endTime}`
}

function eventDateTime(event: Event) {
  const start = new Date(event.datetime)
  if (Number.isNaN(start.getTime())) return event.datetime
  return `${start.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, ${eventTime(event)}`
}

export type EventCalendarSectionProps = {
  isLoading: boolean
  events: Event[]
  calendarTitle: string
  calendarMeta?: string
  ariaLabelPrefix: string
  footer?: ReactNode
}

export function EventCalendarSection({
  isLoading,
  events,
  calendarTitle,
  calendarMeta,
  ariaLabelPrefix,
  footer,
}: EventCalendarSectionProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()))

  const sortedEvents = useMemo(() => [...events].sort(sortEvents), [events])

  const eventsByDay = useMemo(() => {
    const byDay = new Map<string, Event[]>()
    for (const event of sortedEvents) {
      const date = new Date(event.datetime)
      if (Number.isNaN(date.getTime())) continue
      const key = dateKey(date)
      byDay.set(key, [...(byDay.get(key) ?? []), event])
    }
    return byDay
  }, [sortedEvents])

  const calendarDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth])
  const monthLabel = visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })

  function moveMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return (
    <section className="asiCalendar">
      <div className="asiCalendarHeader">
        <div>
          <div className="sectionTitle">{calendarTitle}</div>
          {calendarMeta ? <div className="muted">{calendarMeta}</div> : null}
        </div>
        <div className="asiCalendarControls">
          <button type="button" className="button buttonSecondary buttonCompact" onClick={() => moveMonth(-1)}>
            Previous
          </button>
          <div className="asiCalendarMonth">{monthLabel}</div>
          <button type="button" className="button buttonSecondary buttonCompact" onClick={() => moveMonth(1)}>
            Next
          </button>
        </div>
      </div>

      {isLoading ? (
        <Loading label="Loading calendar…" />
      ) : (
        <>
          <div className="asiCalendarGrid" aria-label={`${ariaLabelPrefix} for ${monthLabel}`}>
            {WEEKDAYS.map((day) => (
              <div key={day} className="asiCalendarWeekday">
                {day}
              </div>
            ))}
            {calendarDays.map((day) => {
              const dayEvents = eventsByDay.get(dateKey(day)) ?? []
              const outsideMonth = day.getMonth() !== visibleMonth.getMonth()
              return (
                <div key={dateKey(day)} className={outsideMonth ? 'asiCalendarDay asiCalendarDayOutside' : 'asiCalendarDay'}>
                  <div className="asiCalendarDate">{day.getDate()}</div>
                  <div className="asiCalendarEvents">
                    {dayEvents.map((event) => (
                      <div
                        key={event.uuid}
                        className={
                          event.status === 'cancelled' ? 'asiCalendarEvent asiCalendarEventCancelled' : 'asiCalendarEvent'
                        }
                      >
                        <span>{eventTime(event)}</span>
                        <strong>{event.title}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="asiUpcomingList">
            <div className="sectionTitle">Upcoming</div>
            {sortedEvents.length > 0 ? (
              <div className="asiEventList">
                {sortedEvents.map((event) => (
                  <div key={event.uuid} className="asiEventRow">
                    <div className="asiEventTitleRow">
                      <span className="asiEventTitle">{event.title}</span>
                      {event.status === 'cancelled' ? <span className="pill pillCancelled">Cancelled</span> : null}
                    </div>
                    <div className="listMeta">
                      <span className="pill">{eventDateTime(event)}</span>
                      {event.address ? <span className="muted">{event.address}</span> : null}
                      {event.agendaUrl ? (
                        <a href={event.agendaUrl} target="_blank" rel="noreferrer">
                          {event.agendaTitle || 'Agenda'}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No upcoming events yet.</div>
            )}
          </div>

          {footer}
        </>
      )}
    </section>
  )
}
