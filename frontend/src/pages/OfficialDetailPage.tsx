import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOfficial, listNews } from '../api/poli'
import { Card } from '../components/Card'
import { ErrorBanner } from '../components/ErrorBanner'
import { Loading } from '../components/Loading'
import type { NewsArticle, Official } from '../types'
import { errorMessage } from '../utils/errors'

export function OfficialDetailPage() {
  const { officialId } = useParams()
  const [official, setOfficial] = useState<Official | null>(null)
  const [news, setNews] = useState<NewsArticle[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!officialId) return
    setError(null)
    setOfficial(null)
    setNews(null)
    Promise.all([getOfficial(officialId), listNews({ officialId, limit: 10 })])
      .then(([o, n]) => {
        setOfficial(o)
        setNews(n)
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [officialId])

  if (!officialId) return <ErrorBanner message="Missing official id." />
  if (error) return <ErrorBanner message={error} />
  if (!official || !news) return <Loading label="Loading…" />

  return (
    <div className="grid">
      <div className="colSpan2">
        <div className="breadcrumbs">
          <Link to="/officials">← Back to civil servants</Link>
        </div>
        <h1 className="pageTitle">{official.name}</h1>
        <p className="pageSubtitle">
          {official.roleTitle} · <span className="muted">{official.areaServed}</span>
        </p>
      </div>

      <Card title="Contact">
        <div className="stack">
          {official.website ? (
            <div>
              <span className="muted">Website</span>
              <div>
                <a href={official.website} target="_blank" rel="noreferrer">
                  {official.website}
                </a>
              </div>
            </div>
          ) : null}
          {official.email ? (
            <div>
              <span className="muted">Email</span>
              <div>
                <a href={`mailto:${official.email}`}>{official.email}</a>
              </div>
            </div>
          ) : null}
          {official.phone ? (
            <div>
              <span className="muted">Phone</span>
              <div>
                <a href={`tel:${official.phone}`}>{official.phone}</a>
              </div>
            </div>
          ) : null}
          {official.officeAddress ? (
            <div>
              <span className="muted">Office</span>
              <div>{official.officeAddress}</div>
            </div>
          ) : null}
          {!official.website && !official.email && !official.phone && !official.officeAddress ? (
            <div className="muted">No contact info yet.</div>
          ) : null}
        </div>
      </Card>

      <Card title="Recent news">
        <div className="list">
          {news.map((a) => (
            <div key={a.id} className="listRow">
              <div className="listMain">
                <a href={a.url} target="_blank" rel="noreferrer" className="listTitle">
                  {a.title}
                </a>
                <div className="listMeta">
                  <span className="pill">{a.source}</span>
                  <span className="muted">{new Date(a.publishedAt).toLocaleString()}</span>
                </div>
                {a.summary ? <div className="muted">{a.summary}</div> : null}
              </div>
            </div>
          ))}
          {news.length === 0 ? <div className="muted">No related articles yet.</div> : null}
        </div>
      </Card>
    </div>
  )
}

