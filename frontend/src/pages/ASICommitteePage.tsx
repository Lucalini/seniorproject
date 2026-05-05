import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listCommitteeFollows, listEvents, setCommitteeFollow } from '../api/poli'
import { useAuth } from '../components/AuthProvider'
import { EventCalendarSection } from '../components/EventCalendarSection'
import { ErrorBanner } from '../components/ErrorBanner'
import { ASI_COMMITTEES, eventMatchesCommitteeTitle } from '../data/asiCommittees'
import type { ASICommittee, Event } from '../types'
import { errorMessage } from '../utils/errors'

function eventMatchesCommittee(event: Event, committee: ASICommittee) {
  if (event.committeeKey) return event.committeeKey === committee.key
  return eventMatchesCommitteeTitle(event.title, committee)
}

export function ASICommitteePage() {
  const { committeeKey } = useParams()
  const { session, user } = useAuth()
  const committee = ASI_COMMITTEES.find((item) => item.key === committeeKey)
  const [events, setEvents] = useState<Event[] | null>(null)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    return (events ?? []).filter((event) => eventMatchesCommittee(event, committee))
  }, [committee, events])

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

      {!error ? (
        <EventCalendarSection
          isLoading={events === null}
          events={committeeEvents}
          calendarTitle="Committee calendar"
          calendarMeta={
            events === null
              ? undefined
              : `${committeeEvents.length} synced upcoming ${committeeEvents.length === 1 ? 'meeting' : 'meetings'}`
          }
          ariaLabelPrefix={`${committee.name} calendar`}
        />
      ) : null}
    </div>
  )
}
