import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEvents, listNews } from '../api/poli'
import { Card } from '../components/Card'
import { ErrorBanner } from '../components/ErrorBanner'
import { Loading } from '../components/Loading'
import type { Event, NewsArticle } from '../types'
import { errorMessage } from '../utils/errors'

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function formatEventTime(event: Event) {
  const start = new Date(event.datetime)
  if (Number.isNaN(start.getTime())) return event.datetime
  const end = event.endDatetime ? new Date(event.endDatetime) : null
  if (!end || Number.isNaN(end.getTime())) return formatDateTime(event.datetime)

  const startDate = start.toLocaleDateString()
  const endDate = end.toLocaleDateString()
  const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return startDate === endDate ? `${startDate}, ${startTime} - ${endTime}` : `${formatDateTime(event.datetime)} - ${end.toLocaleString()}`
}

export function HomePage() {
  const [news, setNews] = useState<NewsArticle[] | null>(null)
  const [events, setEvents] = useState<Event[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setError(null)
    Promise.all([
      listNews({ limit: 10 }).catch((e: unknown) => {
        throw new Error(`News: ${errorMessage(e)}`)
      }),
      listEvents({ limit: 6 }).catch((e: unknown) => {
        throw new Error(`Events: ${errorMessage(e)}`)
      }),
    ])
      .then(([n, ev]) => {
        if (ac.signal.aborted) return
        setNews(n)
        setEvents(ev)
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        setError(errorMessage(e))
      })
    return () => ac.abort()
  }, [])

  const hasData = useMemo(() => news !== null && events !== null, [news, events])

  return (
    <div className="grid">
      <div className="colSpan2">
        <h1 className="pageTitle">Local political news, events, and ASI committees — in one place.</h1>
        <p className="pageSubtitle">
          Start with the latest stories, check upcoming civic events, or follow ASI committee work.
        </p>
      </div>

      {error ? (
        <div className="colSpan2">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      {!hasData ? (
        <div className="colSpan2">
          <Loading label="Loading POLI…" />
        </div>
      ) : (
        <>
          <Card title="Latest news">
            <div className="list">
              {(news ?? []).map((a) => (
                <div key={a.id} className="listRow">
                  <div className="listMain">
                    <a href={a.url} target="_blank" rel="noreferrer" className="listTitle">
                      {a.title}
                    </a>
                    <div className="listMeta">
                      <span className="pill">{a.source}</span>
                      <span className="muted">{formatDateTime(a.publishedAt)}</span>
                    </div>
                    {a.summary ? <div className="muted">{a.summary}</div> : null}
                  </div>
                </div>
              ))}
              {(news ?? []).length === 0 ? <div className="muted">No news items yet.</div> : null}
            </div>
          </Card>

          <Card title="Upcoming events">
            <div className="list">
              {(events ?? []).map((e) => (
                <div key={e.uuid} className="listRow">
                  <div className="listMain">
                    <div className="listTitleRow">
                      <div className="listTitle">{e.title}</div>
                      {e.status === 'cancelled' ? <span className="pill pillCancelled">Cancelled</span> : null}
                    </div>
                    <div className="listMeta">
                      <span className="pill">{formatEventTime(e)}</span>
                      {e.address ? <span className="muted">{e.address}</span> : null}
                    </div>
                    {e.agendaUrl ? (
                      <div className="eventLinks">
                        <a href={e.agendaUrl} target="_blank" rel="noreferrer">
                          {e.agendaTitle || 'View agenda'}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {(events ?? []).length === 0 ? <div className="muted">No upcoming events yet.</div> : null}
            </div>

            <div className="cardActions">
              <Link to="/events" className="button">
                View events
              </Link>
              <Link to="/asi" className="button buttonSecondary">
                Explore ASI
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
