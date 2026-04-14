import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { JSONContent } from '@tiptap/core'
import { OrdinanceDraftEditor } from '../components/OrdinanceDraftEditor'
import { generateOrdinanceDraftPdf } from '../components/OrdinanceDraftPdf'
import {
  createOrdinanceDraft,
  getOrdinanceDraft,
  getUserSelections,
  listCodeTree,
  updateOrdinanceDraft,
} from '../api/poli'
import { useAuth } from '../components/AuthProvider'
import type { CodeNode } from '../types'
import { buildProposedChangesDoc, selectedSectionsInOrder } from '../utils/ordinanceDraft'

function isProposedEmpty(j: unknown): boolean {
  if (!j || typeof j !== 'object') return true
  const doc = j as JSONContent
  if (doc.type !== 'doc' || !doc.content?.length) return true
  const first = doc.content[0]
  if (doc.content.length === 1 && first?.type === 'paragraph' && !first.content?.length) return true
  return false
}

export function OrdinanceDraftPage() {
  const { user, session } = useAuth()
  const token = session?.access_token

  const [roots, setRoots] = useState<CodeNode[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  const [draftId, setDraftId] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [summary, setSummary] = useState('')
  const [reason, setReason] = useState('')
  const [proposedDoc, setProposedDoc] = useState<JSONContent>({
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  })
  const [editorMountKey, setEditorMountKey] = useState(0)

  const [exporting, setExporting] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftIdRef = useRef<string | null>(null)
  draftIdRef.current = draftId

  const sections = useMemo(
    () => selectedSectionsInOrder(roots, selectedIds),
    [roots, selectedIds],
  )

  useEffect(() => {
    if (!user || !token) {
      setBooting(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const tree = await listCodeTree()
        const sels = await getUserSelections(token)
        const ids = new Set<string>()
        for (const s of sels) {
          if (s.selected) ids.add(s.nodeId)
        }
        const draft = await getOrdinanceDraft(token)
        if (cancelled) return
        setRoots(tree)
        setSelectedIds(ids)

        const secs = selectedSectionsInOrder(tree, ids)
        if (draft) {
          setDraftId(draft.id)
          setSubject(draft.subject ?? '')
          setSummary(draft.summaryText ?? '')
          setReason(draft.reasonText ?? '')
          if (!isProposedEmpty(draft.proposedChangesJson)) {
            setProposedDoc(draft.proposedChangesJson as JSONContent)
          } else {
            setProposedDoc(buildProposedChangesDoc(secs))
          }
        } else {
          setProposedDoc(buildProposedChangesDoc(secs))
        }
        setEditorMountKey(k => k + 1)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, token])

  const persist = useCallback(async () => {
    if (!user || !token) return
    const secs = selectedSectionsInOrder(roots, selectedIds)
    if (secs.length === 0) return

    const payload = {
      subject,
      summaryText: summary,
      reasonText: reason,
      proposedChangesJson: proposedDoc as Record<string, unknown>,
    }

    try {
      const id = draftIdRef.current
      if (id) {
        await updateOrdinanceDraft(id, payload, token)
      } else {
        const row = await createOrdinanceDraft(
          { userId: user.id, ...payload, proposedChangesJson: proposedDoc as Record<string, unknown> },
          token,
        )
        if (row?.id) setDraftId(row.id)
      }
    } catch {
      // ignore autosave errors; user can retry by editing
    }
  }, [user, token, subject, summary, reason, proposedDoc, roots, selectedIds])

  useEffect(() => {
    if (!user || booting) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist()
    }, 900)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [user, booting, subject, summary, reason, proposedDoc, persist])

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      await generateOrdinanceDraftPdf({
        sectionNumbers: sections.map(s => s.number),
        subject,
        summary,
        reason,
        proposedDoc,
      })
    } finally {
      setExporting(false)
    }
  }

  if (!user) {
    return (
      <div className="stack" style={{ padding: '32px 0' }}>
        <h1 className="pageTitle">Ordinance Draft</h1>
        <p className="pageSubtitle">Log in to create and save a draft ordinance.</p>
        <p>
          <Link to="/login">Log in</Link>
        </p>
      </div>
    )
  }

  if (booting) {
    return (
      <div style={{ padding: '32px 0' }}>
        <div className="loading"><div className="spinner" /> Loading…</div>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="stack" style={{ padding: '32px 0' }}>
        <h1 className="pageTitle">Ordinance Draft</h1>
        <p className="pageSubtitle">
          No sections selected. Choose sections in the Municipal Code, then return here.
        </p>
        <Link className="button" to="/municipal-code">
          Go to Municipal Code
        </Link>
      </div>
    )
  }

  return (
    <div className="ordPage">
      <div className="ordPageHeader">
        <div>
          <h1 className="pageTitle">Ordinance Draft</h1>
          <p className="pageSubtitle">
            Build a draft ordinance from {sections.length} selected section{sections.length === 1 ? '' : 's'}. Changes save automatically.
          </p>
        </div>
        <div className="mcToolbarActions">
          <button
            type="button"
            className="button"
            disabled={exporting}
            onClick={() => void handleExportPdf()}
          >
            {exporting ? 'Generating…' : 'Export to PDF'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="errorBanner" style={{ marginBottom: 16 }}>
          <div className="errorBannerTitle">Notice</div>
          <div className="errorBannerMessage">{loadError}</div>
        </div>
      )}

      <div className="ordField">
        <label className="fieldLabel" htmlFor="ord-subject">
          Subject (appears in ordinance title after “relating to”)
        </label>
        <input
          id="ord-subject"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g., parking regulations"
        />
      </div>

      <div className="ordBlock">
        <h2 className="ordBlockTitle">Summary of current code</h2>
        <p className="muted ordHint">
          Plain-English explanation of the selected sections. Write or paste text below as needed.
        </p>
        <textarea
          className="ordTextarea"
          rows={8}
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="Summarize the current code in plain English."
        />
      </div>

      <div className="ordBlock">
        <h2 className="ordBlockTitle">Proposed changes</h2>
        <p className="muted ordHint">
          Original section text is shown below. Use strikethrough for text to remove (shown in red) and green insertion for new language.
        </p>
        <OrdinanceDraftEditor
          key={editorMountKey}
          content={proposedDoc}
          onChange={setProposedDoc}
        />
      </div>

      <div className="ordBlock">
        <h2 className="ordBlockTitle">Reason for changes</h2>
        <textarea
          className="ordTextarea"
          rows={5}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Explain why the city should adopt these changes."
        />
      </div>
    </div>
  )
}
