import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listCommitteeFollows, listEvents, setCommitteeFollow } from '../api/poli'
import { useAuth } from '../components/AuthProvider'
import { ErrorBanner } from '../components/ErrorBanner'
import { Loading } from '../components/Loading'
import { ASI_COMMITTEES, eventMatchesCommitteeTitle } from '../data/asiCommittees'
import type { ASICommittee, Event } from '../types'
import { errorMessage } from '../utils/errors'

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

function eventMatchesCommittee(event: Event, committee: ASICommittee) {
  if (event.committeeKey) return event.committeeKey === committee.key
  return eventMatchesCommitteeTitle(event.title, committee)
}

function sortEvents(a: Event, b: Event) {
  return new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
}

export function ASICommitteePage() {
  const { committeeKey } = useParams()
  const { session, user } = useAuth()
  const committee = ASI_COMMITTEES.find((item) => item.key === committeeKey)
  const [events, setEvents] = useState<Event[] | null>(null)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()))

  useEffect(() => {
    const ac = new AbortController()
    setError(null)
    Promise.all([
      listEvents({ limit: 250 }, session?.access_token),
      listCommitteeFollows(session?.access_token, user?.id),
    ])
      .then(([ev, follows]) => {
        if (ac.signal.aborted) return
        setEvents(ev)
        setFollowed(new Set(follows))
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        setError(errorMessage(e))
      })
    return () => ac.abort()
  }, [session, user])

  const committeeEvents = useMemo(() => {
    if (!committee) return []
    return (events ?? []).filter((event) => eventMatchesCommittee(event, committee)).sort(sortEvents)
  }, [committee, events])

  const eventsByDay = useMemo(() => {
    const byDay = new Map<string, Event[]>()
    for (const event of committeeEvents) {
      const date = new Date(event.datetime)
      if (Number.isNaN(date.getTime())) continue
      const key = dateKey(date)
      byDay.set(key, [...(byDay.get(key) ?? []), event])
    }
    return byDay
  }, [committeeEvents])

  const calendarDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth])
  const monthLabel = visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })
  const isFollowing = committee ? followed.has(committee.key) : false

  async function onTrack() {
    if (!committee) return
    const next = !isFollowing
    setSaving(true)
    setError(null)
    try {
      const keys = await setCommitteeFollow(committee.key, next, session?.access_token, user?.id)
      setFollowed(new Set(keys))
    } catch (e: unknown) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function moveMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  if (!committee) {
    return (
      <div className="stack">
        <h1 className="pageTitle">Committee not found</h1>
        <p className="muted">That ASI committee page does not exist.</p>
        <div>
          <Link to="/asi" className="button">
            Back to ASI
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="asiCommitteePage">
      <div className="asiCommitteePageHeader">
        <div>
          <Link to="/asi" className="muted">
            Back to ASI
          </Link>
          <h1 className="pageTitle">{committee.name}</h1>
          <p className="pageSubtitle">{committee.shortName} meetings and committee information.</p>
        </div>
        <div className="asiCommitteeActions">
          {user ? (
            <button type="button" className={isFollowing ? 'button' : 'button buttonSecondary'} onClick={onTrack} disabled={saving}>
              {saving ? 'Saving...' : isFollowing ? 'Tracking' : 'Track'}
            </button>
          ) : (
            <Link to="/login" className="button buttonSecondary">
              Log in to track
            </Link>
          )}
          <a href={committee.committeeUrl} target="_blank" rel="noreferrer" className="button buttonSecondary">
            ASI page
          </a>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <section className="asiCommitteeIntro">
        <div className="sectionTitle">Description</div>
        <p>{committee.description}</p>
      </section>

      <section className="asiCalendar">
        <div className="asiCalendarHeader">
          <div>
            <div className="sectionTitle">Committee calendar</div>
            <div className="muted">{committeeEvents.length} synced upcoming meetings</div>
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

        {events === null ? (
          <Loading label="Loading committee calendar..." />
        ) : (
          <>
            <div className="asiCalendarGrid" aria-label={`${committee.name} calendar for ${monthLabel}`}>
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
                            event.status === 'cancelled'
                              ? 'asiCalendarEvent asiCalendarEventCancelled'
                              : 'asiCalendarEvent'
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
              {committeeEvents.length > 0 ? (
                <div className="asiEventList">
                  {committeeEvents.map((event) => (
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
                <div className="muted">No synced meetings yet.</div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
