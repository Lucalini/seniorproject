import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOfficials } from '../api/poli'
import { Card } from '../components/Card'
import { ErrorBanner } from '../components/ErrorBanner'
import { Loading } from '../components/Loading'
import type { Politician } from '../types'
import { errorMessage } from '../utils/errors'

type SortMode = 'default' | 'nameAsc' | 'nameDesc' | 'level'

const PAGE_SIZE = 10

function sortModeLabel(mode: SortMode) {
  switch (mode) {
    case 'default':
      return 'Default'
    case 'nameAsc':
      return 'Name A–Z'
    case 'nameDesc':
      return 'Name Z–A'
    case 'level':
      return 'Level'
  }
}

function levelRank(level?: string | null) {
  switch ((level ?? '').toLowerCase()) {
    case 'federal':
      return 0
    case 'state':
      return 1
    case 'county':
      return 2
    case 'city':
      return 3
    case 'other':
      return 4
    default:
      return 5
  }
}

export function OfficialsPage() {
  const [officials, setOfficials] = useState<Politician[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('default')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setError(null)
    listOfficials()
      .then(setOfficials)
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [])

  useEffect(() => {
    setPage(1)
  }, [q, sortMode])

  const filteredSorted = useMemo(() => {
    const all = officials ?? []
    const needle = q.trim().toLowerCase()

    const base = all
      .map((o, originalIndex) => ({ o, originalIndex }))
      .filter(({ o }) => {
        if (!needle) return true
        return (o.name ?? '').toLowerCase().includes(needle)
      })

    const sorted = [...base].sort((a, b) => {
      if (sortMode === 'default') return a.originalIndex - b.originalIndex

      if (sortMode === 'level') {
        const byLevel = levelRank(a.o.level) - levelRank(b.o.level)
        if (byLevel !== 0) return byLevel
        return a.o.name.localeCompare(b.o.name)
      }

      if (sortMode === 'nameAsc') return a.o.name.localeCompare(b.o.name)
      if (sortMode === 'nameDesc') return b.o.name.localeCompare(a.o.name)

      return 0
    })

    return sorted.map((x) => x.o)
  }, [officials, q, sortMode])

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return filteredSorted.slice(start, start + PAGE_SIZE)
  }, [filteredSorted, page, totalPages])

  const cycleSort = () => {
    setSortMode((m) => {
      if (m === 'default') return 'nameAsc'
      if (m === 'nameAsc') return 'nameDesc'
      if (m === 'nameDesc') return 'level'
      return 'default'
    })
  }

  return (
    <div className="grid">
      <div className="colSpan2">
        <h1 className="pageTitle">Civil servants</h1>
        <p className="pageSubtitle">Search by name, then sort and page through results.</p>
      </div>

      {error ? (
        <div className="colSpan2">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      <Card title="Results" className="colSpan2">
        {officials === null ? (
          <Loading label="Loading officials…" />
        ) : (
          <div>
            <div className="resultsToolbar">
              <label className="field resultsSearch">
                <span className="fieldLabel">Search</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" />
              </label>
              <div className="resultsToolbarRight">
                <button type="button" className="button buttonSecondary" onClick={cycleSort}>
                  Sort: {sortModeLabel(sortMode)}
                </button>
              </div>
            </div>

            <div className="resultsCountRow">
              <div className="muted">
                {filteredSorted.length} result{filteredSorted.length === 1 ? '' : 's'}
              </div>
              <div className="muted">
                Page {Math.min(page, totalPages)} of {totalPages}
              </div>
            </div>

            <div className="list">
              {pageItems.map((o) => (
                <div key={o.id} className="listRow">
                  <div className="listMain">
                    <Link to={`/officials/${encodeURIComponent(o.id)}`} className="listTitle">
                      {o.name}
                    </Link>
                    <div className="listMeta">
                      {o.level ? <span className="pill pillSoft">{o.level}</span> : null}
                      {o.phone ? <span className="pill">{o.phone}</span> : null}
                      {o.email ? <span className="pill">{o.email}</span> : null}
                    </div>
                    {o.bio ? <div className="muted">{o.bio}</div> : null}
                  </div>
                </div>
              ))}
              {filteredSorted.length === 0 ? <div className="muted">No matches.</div> : null}
            </div>

            {filteredSorted.length > PAGE_SIZE ? (
              <div className="pagination">
                <div className="paginationButtons">
                  <button
                    type="button"
                    className="button buttonSecondary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="button buttonSecondary"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </button>
                </div>
                <div className="muted">
                  Showing {(Math.min(Math.max(1, page), totalPages) - 1) * PAGE_SIZE + (filteredSorted.length ? 1 : 0)}–
                  {Math.min(Math.min(Math.max(1, page), totalPages) * PAGE_SIZE, filteredSorted.length)} of{' '}
                  {filteredSorted.length}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}

