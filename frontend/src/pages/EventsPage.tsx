import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createEvent, listCommitteeFollows, listEvents } from '../api/poli'
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

function formatTimeRange(event: Event) {
  const start = new Date(event.datetime)
  if (Number.isNaN(start.getTime())) return event.datetime

  const end = event.endDatetime ? new Date(event.endDatetime) : null
  const date = start.toLocaleDateString()
  const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (!end || Number.isNaN(end.getTime())) return `${date}, ${startTime}`

  const endDate = end.toLocaleDateString()
  const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return date === endDate ? `${date}, ${startTime} - ${endTime}` : `${date}, ${startTime} - ${endDate}, ${endTime}`
}

export function EventsPage() {
  const { user, session } = useAuth()
  const [events, setEvents] = useState<Event[] | null>(null)
  const [followedCommitteeKeys, setFollowedCommitteeKeys] = useState<string[] | null>(null)
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
    const ac = new AbortController()
    Promise.all([
      listEvents({ limit: 100 }, session?.access_token),
      listCommitteeFollows(session?.access_token, user?.id),
    ])
      .then(([ev, follows]) => {
        if (ac.signal.aborted) return
        setEvents(ev)
        setFollowedCommitteeKeys(follows)
      })
      .catch((e: unknown) => setError(errorMessage(e)))
    return () => ac.abort()
  }, [session, user])

  const filtered = useMemo(() => {
    const all = (events ?? []).filter((event) => {
      if (!user || followedCommitteeKeys === null) return true
      if (event.source !== 'asi_wordpress') return true
      if (!event.committeeKey) return true
      return followedCommitteeKeys.includes(event.committeeKey)
    })
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter((e) => {
      const hay = `${e.title} ${e.address ?? ''} ${e.description ?? ''} ${e.agendaTitle ?? ''} ${e.source ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [events, followedCommitteeKeys, q, user])

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
                    <div className="listTitleRow">
                      <div className="listTitle">{e.title}</div>
                      {e.status === 'cancelled' ? <span className="pill pillCancelled">Cancelled</span> : null}
                    </div>
                    <div className="listMeta">
                      <span className="pill">{formatTimeRange(e)}</span>
                      {e.address ? <span className="muted">{e.address}</span> : null}
                    </div>
                    {e.agendaUrl ? (
                      <div className="eventLinks">
                        <a href={e.agendaUrl} target="_blank" rel="noreferrer" className="button buttonSecondary buttonCompact">
                          {e.agendaTitle || 'View agenda'}
                        </a>
                      </div>
                    ) : null}
                    {e.description ? <div className="muted eventDescription">{e.description}</div> : null}
                  </div>
                </div>
              ))}
              {filtered.length === 0 ? (
                <div className="muted">
                  {user && followedCommitteeKeys?.length === 0
                    ? 'No tracked ASI committee events yet. Track committees from the ASI tab.'
                    : 'No matches.'}
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
