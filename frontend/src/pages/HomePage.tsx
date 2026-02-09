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
        <h1 className="pageTitle">Local political news, events, and officials — in one place.</h1>
        <p className="pageSubtitle">
          Start with the latest stories, check upcoming civic events, or find who represents you in SLO County.
        </p>
      </div>

      {error ? (
        <div className="colSpan2">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      {!hasData ? (
        <div className="colSpan2">
          <Loading label="Loading POLI(SLO)…" />
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
                <div key={e.id} className="listRow">
                  <div className="listMain">
                    <div className="listTitle">{e.title}</div>
                    <div className="listMeta">
                      <span className="pill">{formatDateTime(e.startsAt)}</span>
                      {e.locationName ? <span className="muted">{e.locationName}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
              {(events ?? []).length === 0 ? <div className="muted">No upcoming events yet.</div> : null}
            </div>

            <div className="cardActions">
              <Link to="/events" className="button">
                View events
              </Link>
              <Link to="/officials" className="button buttonSecondary">
                Find civil servants
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

