import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createEvent, listEvents } from '../api/poli'
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
  const [events, setEvents] = useState<Event[] | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateEventInput>({
    title: '',
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    locationName: '',
    address: '',
    description: '',
    link: '',
  })

  useEffect(() => {
    listEvents({ limit: 50 })
      .then(setEvents)
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [])

  const filtered = useMemo(() => {
    const all = events ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter((e) => {
      const hay = `${e.title} ${e.locationName ?? ''} ${e.address ?? ''} ${e.description ?? ''}`.toLowerCase()
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
        locationName: form.locationName?.trim() || undefined,
        address: form.address?.trim() || undefined,
        description: form.description?.trim() || undefined,
        link: form.link?.trim() || undefined,
      })
      setEvents((prev) => [created, ...(prev ?? [])])
      setForm((f) => ({
        ...f,
        title: '',
        description: '',
        link: '',
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
                value={formatDateTimeLocalInput(form.startsAt)}
                onChange={(e) => {
                  const dt = e.target.value
                  const iso = dt ? new Date(dt).toISOString() : new Date().toISOString()
                  setForm((f) => ({ ...f, startsAt: iso }))
                }}
                required
              />
            </label>
            <div className="row2">
              <label className="field">
                <span className="fieldLabel">Location name</span>
                <input
                  value={form.locationName ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, locationName: e.target.value }))}
                  placeholder="e.g. SLO Library, Zoom"
                />
              </label>
              <label className="field">
                <span className="fieldLabel">Address</span>
                <input
                  value={form.address ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Optional"
                />
              </label>
            </div>
            <label className="field">
              <span className="fieldLabel">Link</span>
              <input
                value={form.link ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="Optional (Eventbrite/Zoom/agenda link)"
              />
            </label>
            <label className="field">
              <span className="fieldLabel">Description</span>
              <textarea
                value={form.description ?? ''}
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
        </div>
      </Card>

      <div className="colSpan2">
        <Card title="Upcoming">
          {events === null ? (
            <Loading label="Loading events…" />
          ) : (
            <div className="list">
              {filtered.map((e) => (
                <div key={e.id} className="listRow">
                  <div className="listMain">
                    <div className="listTitle">{e.title}</div>
                    <div className="listMeta">
                      <span className="pill">{new Date(e.startsAt).toLocaleString()}</span>
                      {e.locationName ? <span className="muted">{e.locationName}</span> : null}
                      {e.createdBy ? <span className="pill pillSoft">{e.createdBy}</span> : null}
                    </div>
                    {e.description ? <div className="muted">{e.description}</div> : null}
                    {e.link ? (
                      <div>
                        <a href={e.link} target="_blank" rel="noreferrer">
                          Event link
                        </a>
                      </div>
                    ) : null}
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

