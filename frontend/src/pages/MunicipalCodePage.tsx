import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CodeTree } from '../components/CodeTree'
import { listCodeTree, getUserSelections, upsertSelection } from '../api/poli'
import { useAuth } from '../components/AuthProvider'
import type { CodeNode } from '../types'

export function MunicipalCodePage() {
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const accessToken = session?.access_token

  const [roots, setRoots] = useState<CodeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  const allNodesById = useMemo(() => {
    const map = new Map<string, CodeNode>()
    function walk(nodes: CodeNode[]) {
      for (const n of nodes) {
        map.set(n.id, n)
        if (n.children) walk(n.children)
      }
    }
    walk(roots)
    return map
  }, [roots])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const tree = await listCodeTree()
        if (cancelled) return
        setRoots(tree)

        if (user) {
          const sels = await getUserSelections(accessToken ?? undefined)
          if (cancelled) return
          const ids = new Set<string>()
          for (const s of sels) {
            if (s.selected) ids.add(s.nodeId)
          }
          setSelectedIds(ids)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, accessToken])

  const handleSelect = useCallback(
    (node: CodeNode) => {
      setSelectedIds(prev => {
        const next = new Set(prev)
        const wasSelected = next.has(node.id)
        if (wasSelected) next.delete(node.id)
        else next.add(node.id)

        if (user) {
          upsertSelection(
            node.id,
            { selected: !wasSelected, editedBody: null },
            accessToken ?? undefined,
          )
        }
        return next
      })
    },
    [user, accessToken],
  )

  const handleActivate = useCallback((node: CodeNode) => {
    setActiveId(node.id)
  }, [])

  const activeNode = activeId ? allNodesById.get(activeId) ?? null : null

  const goToDraft = () => {
    if (!user) {
      navigate('/login', { state: { from: '/municipal-code' } })
      return
    }
    if (selectedIds.size === 0) return
    navigate('/ordinance-draft')
  }

  if (loading) {
    return (
      <div style={{ padding: '32px 0' }}>
        <div className="loading"><div className="spinner" /> Loading municipal code...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '32px 0' }}>
        <div className="errorBanner">
          <div className="errorBannerTitle">Error</div>
          <div className="errorBannerMessage">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mcPage">
      <div className="mcToolbar">
        <div>
          <h1 className="pageTitle">Municipal Code</h1>
          <p className="pageSubtitle">
            Browse and select sections to include in an ordinance draft. Editing and PDF export happen on the Ordinance Draft page.
          </p>
        </div>
        <div className="mcToolbarActions">
          <span className="pill">{selectedIds.size} selected</span>
          <button
            type="button"
            className="button"
            disabled={selectedIds.size === 0 || !user}
            onClick={goToDraft}
            title={!user ? 'Log in to create an ordinance draft' : undefined}
          >
            Open Ordinance Draft
          </button>
        </div>
      </div>

      {!user && (
        <p className="pageSubtitle" style={{ marginTop: 0 }}>
          <a href="/login">Log in</a>
          {' '}
          to save your selection and build a draft ordinance.
        </p>
      )}

      <div className="mcLayout">
        <aside className="mcSidebar">
          <CodeTree
            roots={roots}
            selectedIds={selectedIds}
            activeId={activeId}
            onSelect={handleSelect}
            onActivate={handleActivate}
          />
        </aside>

        <section className="mcContent">
          {activeNode?.nodeType === 'section' ? (
            <div className="codeEditor">
              <div className="codeEditorHeader">
                <div>
                  <span className="codeEditorNumber">{activeNode.number}</span>
                  <h2 className="codeEditorTitle">{activeNode.heading}</h2>
                </div>
              </div>
              <div className="codeViewerBody">
                {activeNode.body ?? <span className="muted">No text for this section.</span>}
              </div>
            </div>
          ) : (
            <div className="mcEmptyState">
              <p>Select a section from the outline to read it.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
