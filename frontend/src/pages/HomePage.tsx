import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEvents } from '../api/poli'
import { EventCalendarSection } from '../components/EventCalendarSection'
import { ErrorBanner } from '../components/ErrorBanner'
import type { Event } from '../types'
import { errorMessage } from '../utils/errors'

function sortEvents(a: Event, b: Event) {
  return new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
}

export function HomePage() {
  const [events, setEvents] = useState<Event[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setError(null)
    listEvents({ limit: 250 })
      .then((ev) => {
        if (ac.signal.aborted) return
        setEvents(ev)
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        setError(errorMessage(e))
      })
    return () => ac.abort()
  }, [])

  const sortedEvents = useMemo(() => (events ?? []).sort(sortEvents), [events])

  return (
    <div className="grid">
      <div className="colSpan2">
        <h1 className="pageTitle">Local political events and ASI committees — in one place.</h1>
        <p className="pageSubtitle">Browse what&apos;s coming up on the calendar. More home-page content will land here soon.</p>
      </div>

      {error ? (
        <div className="colSpan2">
          <ErrorBanner message={error} />
        </div>
      ) : (
        <div className="colSpan2">
          <EventCalendarSection
            isLoading={events === null}
            events={sortedEvents}
            calendarTitle="Upcoming events"
            calendarMeta={
              events === null ? undefined : `${sortedEvents.length} upcoming ${sortedEvents.length === 1 ? 'event' : 'events'}`
            }
            ariaLabelPrefix="Community events calendar"
            footer={
              <div className="cardActions">
                <Link to="/events" className="button">
                  Events list
                </Link>
                <Link to="/asi" className="button buttonSecondary">
                  ASI committees
                </Link>
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}
