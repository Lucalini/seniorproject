import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createEvent, listEvents } from '../api/poli'
import { useAuth } from '../components/AuthProvider'
import { Card } from '../components/Card'
import { ErrorBanner } from '../components/ErrorBanner'
import { Loading } from '../components/Loading'
import type { CreateEventInput, Event } from '../types'
import { errorMessage } from '../utils/errors'

function formatDateTimeLocalInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

export function EventsPage() {
  const { user, session } = useAuth()
  const [events, setEvents] = useState<Event[] | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateEventInput>({
    title: '',
    datetime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    address: '',
    description: '',
    imagePath: 'events/default.png',
  })

  useEffect(() => {
    listEvents({ limit: 50 }, session?.access_token)
      .then(setEvents)
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [session])

  const filtered = useMemo(() => {
    const all = events ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter((e) => {
      const hay = `${e.title} ${e.address ?? ''} ${e.description ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [events, q])

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await createEvent({
        ...form,
        title: form.title.trim(),
        address: form.address.trim(),
        description: form.description.trim(),
        imagePath: form.imagePath?.trim() || 'events/default.png',
      }, session?.access_token)
      setEvents((prev) => [created, ...(prev ?? [])])
      setForm((f) => ({
        ...f,
        title: '',
        description: '',
      }))
    } catch (e: unknown) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid">
      <div className="colSpan2">
        <h1 className="pageTitle">Political events</h1>
        <p className="pageSubtitle">Browse upcoming meetings, rallies, canvasses, and community events — or schedule one.</p>
      </div>

      {error ? (
        <div className="colSpan2">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      <Card title="Map view (placeholder)">
        <div className="mapPlaceholder">
          Map integration comes next (Leaflet/Mapbox). For now, use search + list.
        </div>
      </Card>

      <Card title="Search / schedule">
        <div className="stack">
          <label className="field">
            <span className="fieldLabel">Search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. board meeting, Paso Robles, housing" />
          </label>

          {user ? (
            <form onSubmit={onSubmit} className="stack">
              <div className="sectionTitle">Scheduling an event</div>
              <label className="field">
                <span className="fieldLabel">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. SLO City Council meeting watch party"
                  required
                />
              </label>
              <label className="field">
                <span className="fieldLabel">Date / time</span>
                <input
                  type="datetime-local"
                  value={formatDateTimeLocalInput(form.datetime)}
                  onChange={(e) => {
                    const dt = e.target.value
                    const iso = dt ? new Date(dt).toISOString() : new Date().toISOString()
                    setForm((f) => ({ ...f, datetime: iso }))
                  }}
                  required
                />
              </label>
              <label className="field">
                <span className="fieldLabel">Address</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street address"
                  required
                />
              </label>
              <label className="field">
                <span className="fieldLabel">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional"
                  rows={4}
                />
              </label>

              <div className="cardActions">
                <button className="button" disabled={saving}>
                  {saving ? 'Saving…' : 'Submit event'}
                </button>
              </div>
            </form>
          ) : (
            <div className="authGatePrompt">
              <p className="sectionTitle">Want to schedule an event?</p>
              <p className="muted">
                <Link to="/login">Log in</Link> to post an event to the community calendar.
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="colSpan2">
        <Card title="Upcoming">
          {events === null ? (
            <Loading label="Loading events…" />
          ) : (
            <div className="list">
              {filtered.map((e) => (
                <div key={e.uuid} className="listRow">
                  <div className="listMain">
                    <div className="listTitle">{e.title}</div>
                    <div className="listMeta">
                      <span className="pill">{new Date(e.datetime).toLocaleString()}</span>
                      {e.address ? <span className="muted">{e.address}</span> : null}
                    </div>
                    {e.description ? <div className="muted">{e.description}</div> : null}
                  </div>
                </div>
              ))}
              {filtered.length === 0 ? <div className="muted">No matches.</div> : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

