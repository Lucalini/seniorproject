import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOfficials } from '../api/poli'
import { Card } from '../components/Card'
import { ErrorBanner } from '../components/ErrorBanner'
import { Loading } from '../components/Loading'
import type { Official } from '../types'
import { errorMessage } from '../utils/errors'

export function OfficialsPage() {
  const [officials, setOfficials] = useState<Official[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('')
  const [areaServed, setAreaServed] = useState('')

  useEffect(() => {
    setError(null)
    listOfficials()
      .then(setOfficials)
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [])

  const filtered = useMemo(() => {
    const all = officials ?? []
    const needle = q.trim().toLowerCase()
    return all.filter((o) => {
      if (level && (o.level ?? '').toLowerCase() !== level.toLowerCase()) return false
      if (areaServed && !o.areaServed.toLowerCase().includes(areaServed.trim().toLowerCase())) return false
      if (!needle) return true
      const hay = `${o.name} ${o.roleTitle} ${o.areaServed}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [officials, q, level, areaServed])

  return (
    <div className="grid">
      <div className="colSpan2">
        <h1 className="pageTitle">Civil servants</h1>
        <p className="pageSubtitle">Search by name, location/area served, or level of government.</p>
      </div>

      {error ? (
        <div className="colSpan2">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      <Card title="Search">
        <div className="stack">
          <label className="field">
            <span className="fieldLabel">Name / role</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. supervisor, mayor, senator, Jane Doe" />
          </label>
          <label className="field">
            <span className="fieldLabel">Area served</span>
            <input value={areaServed} onChange={(e) => setAreaServed(e.target.value)} placeholder="e.g. District 2, San Luis Obispo, Paso Robles" />
          </label>
          <label className="field">
            <span className="fieldLabel">Level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Any</option>
              <option value="city">City</option>
              <option value="county">County</option>
              <option value="state">State</option>
              <option value="federal">Federal</option>
              <option value="other">Other</option>
            </select>
          </label>
          <div className="muted">
            Tip: later we can auto-fill “who represents me” from your address using district boundaries + a civic API.
          </div>
        </div>
      </Card>

      <Card title="Results">
        {officials === null ? (
          <Loading label="Loading officials…" />
        ) : (
          <div className="list">
            {filtered.map((o) => (
              <div key={o.id} className="listRow">
                <div className="listMain">
                  <Link to={`/officials/${encodeURIComponent(o.id)}`} className="listTitle">
                    {o.name}
                  </Link>
                  <div className="listMeta">
                    <span className="pill">{o.roleTitle}</span>
                    <span className="muted">{o.areaServed}</span>
                    {o.level ? <span className="pill pillSoft">{o.level}</span> : null}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 ? <div className="muted">No matches.</div> : null}
          </div>
        )}
      </Card>
    </div>
  )
}

