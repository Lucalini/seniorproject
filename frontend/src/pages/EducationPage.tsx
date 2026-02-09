import { useEffect, useState } from 'react'
import { listEducation } from '../api/poli'
import { Card } from '../components/Card'
import { ErrorBanner } from '../components/ErrorBanner'
import { Loading } from '../components/Loading'
import type { EducationTopic } from '../types'
import { errorMessage } from '../utils/errors'

export function EducationPage() {
  const [topics, setTopics] = useState<EducationTopic[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    listEducation()
      .then(setTopics)
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [])

  return (
    <div className="grid">
      <div className="colSpan2">
        <h1 className="pageTitle">Education</h1>
        <p className="pageSubtitle">How local government works in SLO County, and practical ways to create change.</p>
      </div>

      {error ? (
        <div className="colSpan2">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      {topics === null ? (
        <div className="colSpan2">
          <Loading label="Loading education topics…" />
        </div>
      ) : (
        <>
          {topics.map((t) => (
            <Card key={t.id} title={t.title}>
              <div className="stack">
                <div className="muted">{t.description}</div>
                <ul className="bullets">
                  {t.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
          {topics.length === 0 ? (
            <div className="colSpan2">
              <div className="muted">No topics yet.</div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

