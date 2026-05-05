import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  createBulletinComment,
  createBulletinThread,
  deleteBulletinComment,
  deleteBulletinThread,
  getBulletinPreferences,
  getBulletinThread,
  listBulletinThreads,
  saveBulletinPreferences,
  setBulletinCommentVote,
  setBulletinThreadVote,
  submitBulletinPollResponse,
  updateBulletinComment,
  updateBulletinThread,
} from '../api/poli'
import { useAuth } from '../components/AuthProvider'
import { ASI_COMMITTEES } from '../data/asiCommittees'
import type { BulletinThread } from '../types'
import { errorMessage } from '../utils/errors'

type ThreadType = 'normal' | 'poll' | 'event'
type ThreadStatus = 'active' | 'hidden' | 'archived'
type SortKey = 'newest' | 'oldest' | 'most-upvoted' | 'most-commented'

type BoardTag = {
  key: string
  label: string
}

type CommentSeed = {
  id: string
  persisted?: boolean
  author: string
  authorId?: string
  createdAt: string
  editedAt?: string
  body: string
  likes: number
  dislikes: number
  deleted?: boolean
  replies?: CommentSeed[]
}

type ThreadSeed = {
  id: string
  persisted?: boolean
  authorId?: string
  type: ThreadType
  status: ThreadStatus
  author: string
  title: string
  body: string
  createdAt: string
  editedAt?: string
  tags: string[]
  likes: number
  dislikes: number
  comments: CommentSeed[]
  poll?: {
    closesAt?: string
    selectedOptionIds?: string[]
    options: Array<{ id: string; label: string; votes: number }>
  }
  event?: {
    location?: string
    startsAt: string
    endsAt?: string
  }
}

const BOARD_TAGS: BoardTag[] = [
  { key: 'suggestions', label: 'Suggestions' },
  ...ASI_COMMITTEES.map((committee) => ({ key: committee.key, label: committee.shortName })),
]

const THREAD_TYPE_LABELS: Record<ThreadType, string> = {
  normal: 'Thread',
  poll: 'Poll',
  event: 'Event',
}

const THREADS: ThreadSeed[] = [
  {
    id: 'accessibility-feedback',
    type: 'normal',
    status: 'active',
    author: 'Maya Chen',
    title: 'Collecting feedback on accessibility barriers around campus',
    body:
      'Use this thread to collect concrete accessibility issues that should be raised during the next open forum. Specific location details are more useful than broad complaints.',
    createdAt: '2026-05-04T17:20:00-07:00',
    editedAt: '2026-05-04T18:04:00-07:00',
    tags: ['suggestions', 'asi-deij'],
    likes: 18,
    dislikes: 2,
    comments: [
      {
        id: 'c1',
        author: 'Jordan Patel',
        createdAt: '2026-05-04T17:42:00-07:00',
        body: 'The ramp near the UU was blocked during lunch yesterday. A temporary sign would have helped.',
        likes: 9,
        dislikes: 0,
        replies: [
          {
            id: 'c1-r1',
            author: 'Sam Rivera',
            createdAt: '2026-05-04T18:10:00-07:00',
            body: 'I can bring this up with facilities if someone has a photo or exact time.',
            likes: 4,
            dislikes: 0,
            replies: [
              {
                id: 'c1-r1-r1',
                author: 'Maya Chen',
                createdAt: '2026-05-04T18:35:00-07:00',
                body: 'I have the timestamp. I will add it to the notes before Friday.',
                likes: 3,
                dislikes: 0,
              },
            ],
          },
        ],
      },
      {
        id: 'c2',
        author: 'Deleted user',
        createdAt: '2026-05-04T19:03:00-07:00',
        body: '',
        likes: 0,
        dislikes: 0,
        deleted: true,
      },
    ],
  },
  {
    id: 'meeting-time-poll',
    type: 'poll',
    status: 'active',
    author: 'ASI Secretary',
    title: 'Which committee update time is easiest to attend?',
    body:
      'This mock poll represents the multiple-choice poll model. Results stay hidden until after voting in the real implementation.',
    createdAt: '2026-05-03T12:15:00-07:00',
    tags: ['asi-board-of-directors'],
    likes: 11,
    dislikes: 1,
    comments: [
      {
        id: 'c3',
        author: 'Taylor Nguyen',
        createdAt: '2026-05-03T13:01:00-07:00',
        body: 'Evenings work better for students with lab blocks.',
        likes: 5,
        dislikes: 1,
      },
    ],
    poll: {
      closesAt: '2026-05-10T17:00:00-07:00',
      options: [
        { id: 'monday', label: 'Monday afternoon', votes: 12 },
        { id: 'wednesday', label: 'Wednesday evening', votes: 24 },
        { id: 'friday', label: 'Friday morning', votes: 7 },
      ],
    },
  },
  {
    id: 'budget-workshop',
    type: 'event',
    status: 'archived',
    author: 'Alex Morgan',
    title: 'Budget priorities workshop',
    body:
      'A working session for gathering budget priorities before the next finance discussion. Archived threads remain readable but cannot be voted on.',
    createdAt: '2026-05-01T09:00:00-07:00',
    tags: ['suggestions', 'asi-business-finance'],
    likes: 7,
    dislikes: 0,
    comments: [],
    event: {
      location: 'University Union 220',
      startsAt: '2026-05-09T15:00:00-07:00',
      endsAt: '2026-05-09T16:30:00-07:00',
    },
  },
]

function mapPersistedThread(thread: BulletinThread): ThreadSeed {
  return {
    id: thread.id,
    persisted: true,
    authorId: thread.authorId,
    type: thread.threadType,
    status: thread.status,
    author: thread.authorDisplayName,
    title: thread.title,
    body: thread.body,
    createdAt: thread.createdAt,
    editedAt: thread.editedAt ?? undefined,
    tags: thread.tags,
    likes: thread.likes,
    dislikes: thread.dislikes,
    comments: thread.comments.map(mapPersistedComment),
    poll: thread.threadType === 'poll'
      ? {
          closesAt: thread.pollClosesAt ?? undefined,
          selectedOptionIds: thread.pollResponseOptionIds,
          options: thread.pollOptions.map((option) => ({ id: option.id, label: option.body, votes: option.votes })),
        }
      : undefined,
    event: thread.threadType === 'event' && thread.eventStartsAt
      ? {
          location: thread.eventLocation ?? undefined,
          startsAt: thread.eventStartsAt,
          endsAt: thread.eventEndsAt ?? undefined,
        }
      : undefined,
  }
}

function mapPersistedComment(comment: BulletinThread['comments'][number]): CommentSeed {
  return {
    id: comment.id,
    persisted: true,
    authorId: comment.authorId,
    author: comment.deletedAt ? 'Deleted user' : comment.authorDisplayName,
    createdAt: comment.createdAt,
    editedAt: comment.editedAt ?? undefined,
    body: comment.deletedAt ? '' : comment.body,
    likes: comment.likes,
    dislikes: comment.dislikes,
    deleted: Boolean(comment.deletedAt),
    replies: comment.replies?.map(mapPersistedComment),
  }
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  }).format(new Date(iso))
}

function countComments(comments: CommentSeed[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies ?? []), 0)
}

function getTagLabel(tagKey: string) {
  return BOARD_TAGS.find((tag) => tag.key === tagKey)?.label ?? tagKey
}

function sortedThreads(threads: ThreadSeed[], sort: SortKey) {
  return [...threads].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (sort === 'most-upvoted') return b.likes - a.likes
    if (sort === 'most-commented') return countComments(b.comments) - countComments(a.comments)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function ThreadTypeBadge({ type }: { type: ThreadType }) {
  return <span className={`bbTypeBadge bbTypeBadge-${type}`}>{THREAD_TYPE_LABELS[type]}</span>
}

function FilterIcon() {
  return (
    <svg className="bbSvgIcon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="bbSvgIcon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="bbSvgIcon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg className="bbSvgIcon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5l-7 7M12 5l7 7M12 5v14" />
    </svg>
  )
}

function ArrowDownIcon() {
  return (
    <svg className="bbSvgIcon" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 19l-7-7M12 19l7-7M12 19V5" />
    </svg>
  )
}

function BoardVoteButtons({
  likes,
  dislikes,
  disabled,
  onAuthRequired,
  onVote,
}: {
  likes: number
  dislikes: number
  disabled: boolean
  onAuthRequired?: () => void
  onVote?: (value: 1 | -1) => void
}) {
  function handleVote(value: 1 | -1) {
    if (onVote) {
      onVote(value)
      return
    }
    onAuthRequired?.()
  }

  return (
    <div className="bbVotes" aria-label="Vote totals">
      <button className="bbVoteButton" disabled={disabled} type="button" aria-label={`${likes} upvotes`} title="Upvote" onClick={() => handleVote(1)}>
        <ArrowUpIcon />
        <span>{likes}</span>
      </button>
      <button className="bbVoteButton" disabled={disabled} type="button" aria-label={`${dislikes} downvotes`} title="Downvote" onClick={() => handleVote(-1)}>
        <ArrowDownIcon />
        <span>{dislikes}</span>
      </button>
    </div>
  )
}

function AuthRequiredPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="bbModalBackdrop" role="presentation" onMouseDown={onClose}>
      <section className="bbAuthPopup" role="dialog" aria-modal="true" aria-labelledby="bbAuthPopupTitle" onMouseDown={(ev) => ev.stopPropagation()}>
        <div className="bbModalHeader">
          <div>
            <h2 id="bbAuthPopupTitle">Log in required</h2>
            <p className="muted">Posting, commenting, and voting require an account.</p>
          </div>
          <button className="bbIconButton" type="button" onClick={onClose} aria-label="Close login prompt">
            x
          </button>
        </div>
        <div className="bbModalActions">
          <button className="button buttonSecondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <Link to="/login" className="button">
            Log in
          </Link>
        </div>
      </section>
    </div>
  )
}

function ThreadCard({
  thread,
  canInteract,
  onAuthRequired,
  onVote,
  onPollVote,
}: {
  thread: ThreadSeed
  canInteract: boolean
  onAuthRequired: () => void
  onVote: (threadId: string, value: 1 | -1) => void
  onPollVote: (thread: ThreadSeed, pollOptionIds: string[]) => void
}) {
  const archived = thread.status === 'archived'

  return (
    <article className="bbThreadCard">
      <div className="bbThreadCardTop">
        <div className="bbThreadTaxonomy">
          <ThreadTypeBadge type={thread.type} />
          <div className="bbTagRow">
            {thread.tags.map((tag) => (
              <span key={tag} className="pill pillSoft">
                {getTagLabel(tag)}
              </span>
            ))}
          </div>
        </div>
        <div className="bbMetaLine bbMetaLineRight">
          <span>{thread.author}</span>
          <span>{formatDateTime(thread.createdAt)}</span>
          {thread.editedAt ? <span>Edited {formatDateTime(thread.editedAt)}</span> : null}
          {archived ? <span className="pill">Archived</span> : null}
        </div>
      </div>

      <Link to={`/bulletin-board/${thread.id}`} className="bbThreadTitle">
        {thread.title}
      </Link>
      <p className="bbThreadBody">{thread.body}</p>

      {thread.type === 'poll' && thread.poll ? (
        <PollPanel
          thread={thread}
          canInteract={canInteract}
          onAuthRequired={onAuthRequired}
          onSubmit={(optionIds) => onPollVote(thread, optionIds)}
          title="Poll preview"
        />
      ) : null}

      {thread.type === 'event' && thread.event ? (
        <div className="bbInlinePanel">
          <div className="bbInlinePanelTitle">Event details</div>
          <div className="bbEventDetails">
            {thread.event.location ? <span>{thread.event.location}</span> : null}
            <span>{formatDateTime(thread.event.startsAt)}</span>
            {thread.event.endsAt ? <span>Ends {formatDateTime(thread.event.endsAt)}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="bbThreadFooter">
        <div className="bbThreadFooterLeft">
          <BoardVoteButtons
            likes={thread.likes}
            dislikes={thread.dislikes}
            disabled={archived}
            onAuthRequired={canInteract ? undefined : onAuthRequired}
            onVote={canInteract ? (value) => onVote(thread.id, value) : undefined}
          />
        </div>
        <div className="bbCommentEntry">
          <span className="muted">{countComments(thread.comments)} comments</span>
          <Link to={`/bulletin-board/${thread.id}`} className="button buttonSecondary buttonCompact">
            Comment
          </Link>
        </div>
      </div>
    </article>
  )
}

function pollIsClosed(thread: ThreadSeed) {
  if (thread.status === 'archived') return true
  if (!thread.poll?.closesAt) return false
  return new Date(thread.poll.closesAt).getTime() <= Date.now()
}

function PollPanel({
  thread,
  canInteract,
  onAuthRequired,
  onSubmit,
  title,
}: {
  thread: ThreadSeed
  canInteract: boolean
  onAuthRequired: () => void
  onSubmit: (pollOptionIds: string[]) => void
  title: string
}) {
  const poll = thread.poll
  const savedSelections = useMemo(() => poll?.selectedOptionIds ?? [], [poll?.selectedOptionIds])
  const [selected, setSelected] = useState<string[]>(savedSelections)

  useEffect(() => {
    setSelected(savedSelections)
  }, [savedSelections])

  if (!poll) return null

  const voted = savedSelections.length > 0
  const closed = pollIsClosed(thread)
  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0)

  function toggleOption(optionId: string) {
    if (voted || closed) return
    setSelected((current) => current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId])
  }

  function submitVote() {
    if (!canInteract) {
      onAuthRequired()
      return
    }
    if (selected.length === 0 || voted || closed) return
    onSubmit(selected)
  }

  return (
    <div className="bbInlinePanel">
      <div className="bbInlinePanelTitle">{title}</div>
      <div className="bbPollOptions">
        {poll.options.map((option) => {
          const checked = selected.includes(option.id)
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
          return (
            <label key={option.id} className={voted || closed ? 'bbPollOption bbPollOptionDisabled' : 'bbPollOption'}>
              <input
                type="checkbox"
                checked={checked}
                disabled={voted || closed}
                onChange={() => toggleOption(option.id)}
              />
              <span>{option.label}</span>
              {voted ? <span className="muted">{option.votes} votes, {pct}%</span> : null}
            </label>
          )
        })}
      </div>
      <div className="bbPollFooter">
        {poll.closesAt ? <span className="muted">Closes {formatDateTime(poll.closesAt)}</span> : <span className="muted">No close date</span>}
        {voted ? <span className="muted">Vote recorded</span> : closed ? <span className="muted">Poll closed</span> : (
          <button className="button buttonSecondary buttonCompact" type="button" onClick={submitVote} disabled={selected.length === 0}>
            Vote
          </button>
        )}
      </div>
    </div>
  )
}

function ComposerModal({
  canPost,
  onClose,
  onCreate,
}: {
  canPost: boolean
  onClose: () => void
  onCreate: (input: {
    title: string
    body: string
    threadType: ThreadType
    tagKeys: string[]
    pollClosesAt: string | null
    pollOptions: string[]
    eventLocation: string | null
    eventStartsAt: string | null
    eventEndsAt: string | null
  }) => Promise<void>
}) {
  const [type, setType] = useState<ThreadType>('normal')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pollClosesAt, setPollClosesAt] = useState('')
  const [pollOptions, setPollOptions] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventStartsAt, setEventStartsAt] = useState('')
  const [eventEndsAt, setEventEndsAt] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleTag(tagKey: string) {
    setSelectedTags((current) => {
      if (current.includes(tagKey)) return current.filter((key) => key !== tagKey)
      if (current.length >= 2) return current
      return [...current, tagKey]
    })
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!canPost) return
    setSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        body: body.trim(),
        threadType: type,
        tagKeys: selectedTags,
        pollClosesAt: pollClosesAt ? new Date(pollClosesAt).toISOString() : null,
        pollOptions: pollOptions
          .split('\n')
          .map((option) => option.trim())
          .filter(Boolean),
        eventLocation: eventLocation.trim() || null,
        eventStartsAt: eventStartsAt ? new Date(eventStartsAt).toISOString() : null,
        eventEndsAt: eventEndsAt ? new Date(eventEndsAt).toISOString() : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bbModalBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="bbModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bbComposerTitle"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <div className="bbModalHeader">
          <div>
            <h2 id="bbComposerTitle">New bulletin thread</h2>
            <p className="muted">Prototype composer. Database persistence comes in the next pass.</p>
          </div>
          <button className="bbIconButton" type="button" onClick={onClose} aria-label="Close composer">
            x
          </button>
        </div>

        <form className="bbComposerForm" onSubmit={onSubmit}>
          <div className="bbSegmented" aria-label="Thread type">
            {(['normal', 'poll', 'event'] as ThreadType[]).map((nextType) => (
              <button
                key={nextType}
                type="button"
                className={nextType === type ? 'bbSegmentActive' : ''}
                onClick={() => setType(nextType)}
                disabled={!canPost}
              >
                {THREAD_TYPE_LABELS[nextType]}
              </button>
            ))}
          </div>

          <label className="field">
            <span className="fieldLabel">Title</span>
            <input disabled={!canPost || saving} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Concise thread title" required />
          </label>

          <label className="field">
            <span className="fieldLabel">Body</span>
            <textarea disabled={!canPost || saving} value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Plain text for now. Markdown can be added later." required />
          </label>

          <div className="field">
            <span className="fieldLabel">Tags, up to 2</span>
            <div className="bbTagPicker">
              {BOARD_TAGS.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  className={selectedTags.includes(tag.key) ? 'bbTagChoice bbTagChoiceActive' : 'bbTagChoice'}
                  onClick={() => toggleTag(tag.key)}
                  disabled={!canPost || saving}
                >
                  {tag.label}
                </button>
              ))}
              <span className="muted">No tag is allowed.</span>
            </div>
          </div>

          {type === 'poll' ? (
            <div className="bbConditionalFields">
              <label className="field">
                <span className="fieldLabel">Poll closes</span>
                <input disabled={!canPost || saving} type="datetime-local" value={pollClosesAt} onChange={(e) => setPollClosesAt(e.target.value)} />
              </label>
              <label className="field">
                <span className="fieldLabel">Options</span>
                <textarea disabled={!canPost || saving} rows={4} value={pollOptions} onChange={(e) => setPollOptions(e.target.value)} placeholder="One option per line" />
              </label>
            </div>
          ) : null}

          {type === 'event' ? (
            <div className="bbConditionalFields">
              <label className="field">
                <span className="fieldLabel">Location, optional</span>
                <input disabled={!canPost || saving} value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="University Union 220" />
              </label>
              <div className="row2">
                <label className="field">
                  <span className="fieldLabel">Event starts</span>
                  <input disabled={!canPost || saving} type="datetime-local" value={eventStartsAt} onChange={(e) => setEventStartsAt(e.target.value)} />
                </label>
                <label className="field">
                  <span className="fieldLabel">Event ends, optional</span>
                  <input disabled={!canPost || saving} type="datetime-local" value={eventEndsAt} onChange={(e) => setEventEndsAt(e.target.value)} />
                </label>
              </div>
            </div>
          ) : null}

          <div className="bbModalActions">
            <button className="button buttonSecondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button" type="submit" disabled={!canPost || saving}>
              {saving ? 'Creating...' : 'Create thread'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function BulletinBoardPage() {
  const { user, session } = useAuth()
  const [threads, setThreads] = useState<ThreadSeed[]>(THREADS)
  const [sort, setSort] = useState<SortKey>('newest')
  const [visibleTags, setVisibleTags] = useState<string[]>(BOARD_TAGS.map((tag) => tag.key))
  const [hiddenTypes, setHiddenTypes] = useState<ThreadType[]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const preferencesLoaded = useRef(false)

  useEffect(() => {
    const ac = new AbortController()
    preferencesLoaded.current = false
    setBoardError(null)
    Promise.all([
      listBulletinThreads(session?.access_token),
      getBulletinPreferences(session?.access_token),
    ])
      .then(([items, preferences]) => {
        if (ac.signal.aborted) return
        if (items.length > 0) setThreads(items.map(mapPersistedThread))
        if (preferences) {
          setSort(preferences.sortOrder)
          setHiddenTypes(preferences.hiddenThreadTypes)
          setVisibleTags(BOARD_TAGS.map((tag) => tag.key).filter((tagKey) => !preferences.hiddenTagKeys.includes(tagKey)))
        }
        preferencesLoaded.current = true
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        setBoardError(errorMessage(e))
      })
    return () => ac.abort()
  }, [session])

  useEffect(() => {
    if (!session?.access_token || !preferencesLoaded.current) return
    const hiddenTagKeys = BOARD_TAGS.map((tag) => tag.key).filter((tagKey) => !visibleTags.includes(tagKey))
    const handle = window.setTimeout(() => {
      saveBulletinPreferences({
        hiddenTagKeys,
        hiddenThreadTypes: hiddenTypes,
        sortOrder: sort,
      }, session.access_token).catch((e: unknown) => setBoardError(errorMessage(e)))
    }, 350)
    return () => window.clearTimeout(handle)
  }, [hiddenTypes, session, sort, visibleTags])

  async function refreshThreads() {
    const persisted = await listBulletinThreads(session?.access_token)
    setThreads(persisted.length > 0 ? persisted.map(mapPersistedThread) : THREADS)
  }

  const visibleThreads = useMemo(() => {
    const filtered = threads.filter((thread) => {
      const tagVisible = thread.tags.length === 0 || thread.tags.some((tag) => visibleTags.includes(tag))
      const typeHidden = hiddenTypes.includes(thread.type)
      return tagVisible && !typeHidden && thread.status !== 'hidden'
    })
    return sortedThreads(filtered, sort)
  }, [threads, visibleTags, hiddenTypes, sort])

  function toggleVisibleTag(tagKey: string) {
    setVisibleTags((current) => current.includes(tagKey) ? current.filter((key) => key !== tagKey) : [...current, tagKey])
  }

  function toggleHiddenType(type: ThreadType) {
    setHiddenTypes((current) => current.includes(type) ? current.filter((key) => key !== type) : [...current, type])
  }

  function requestNewThread() {
    if (!user) {
      setAuthPromptOpen(true)
      return
    }
    setComposerOpen(true)
  }

  async function handleCreateThread(input: Parameters<typeof createBulletinThread>[0]) {
    if (!session?.access_token) {
      setAuthPromptOpen(true)
      return
    }
    setBoardError(null)
    await createBulletinThread(input, session.access_token)
    await refreshThreads()
  }

  async function handleThreadVote(threadId: string, value: 1 | -1) {
    if (!session?.access_token) {
      setAuthPromptOpen(true)
      return
    }
    if (!threads.find((thread) => thread.id === threadId)?.persisted) {
      setBoardError('This demo thread is not persisted yet. Create a real thread after applying the Bulletin Board migration.')
      return
    }
    setBoardError(null)
    try {
      await setBulletinThreadVote(threadId, value, session.access_token)
      await refreshThreads()
    } catch (e: unknown) {
      setBoardError(errorMessage(e))
    }
  }

  async function handlePollVote(thread: ThreadSeed, pollOptionIds: string[]) {
    if (!session?.access_token) {
      setAuthPromptOpen(true)
      return
    }
    if (!thread.persisted) {
      setBoardError('This demo poll is not persisted yet. Create a real poll after applying the Bulletin Board migration.')
      return
    }
    setBoardError(null)
    try {
      await submitBulletinPollResponse(thread.id, pollOptionIds, session.access_token)
      await refreshThreads()
    } catch (e: unknown) {
      setBoardError(errorMessage(e))
    }
  }

  return (
    <div className="bbPage">
      <div className="bbHero">
        <div>
          <h1 className="pageTitle">Bulletin Board</h1>
          <p className="pageSubtitle">
            Public read-only feed for threads, polls, events, and tagged suggestions.
          </p>
        </div>
      </div>

      <div className="bbToolbar">
        <div className="bbToolbarLeft">
          <button className="button" type="button" onClick={requestNewThread}>
            New thread
          </button>
        </div>
        <div className="bbToolbarRight">
          <div className="bbToolbarMeta">
            <span>{visibleThreads.length} visible threads</span>
            {visibleTags.length < BOARD_TAGS.length ? <span>{BOARD_TAGS.length - visibleTags.length} tag filter hidden</span> : null}
            {hiddenTypes.length > 0 ? <span>{hiddenTypes.length} type filter hidden</span> : null}
          </div>
          <div className="bbFilterMenuWrap">
            <button
              className={filtersOpen ? 'bbFilterIconButton bbFilterIconButtonActive' : 'bbFilterIconButton'}
              type="button"
              aria-label="Open Bulletin Board filters"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <FilterIcon />
            </button>

            {filtersOpen ? (
              <section className="bbFilterDropdown" aria-label="Bulletin Board filters">
                <div className="bbFilterSection">
                  <div className="bbFilterTitle">Sort</div>
                  <div className="bbSortOptions">
                    {([
                      ['newest', 'Age, newest first'],
                      ['oldest', 'Age, oldest first'],
                      ['most-upvoted', 'Most upvoted'],
                      ['most-commented', 'Most commented'],
                    ] as Array<[SortKey, string]>).map(([nextSort, label]) => (
                      <button
                        key={nextSort}
                        type="button"
                        className={sort === nextSort ? 'bbSortOption bbSortOptionActive' : 'bbSortOption'}
                        onClick={() => setSort(nextSort)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bbFilterSection">
                  <div className="bbFilterTitle">Types</div>
                  <div className="bbFilterGroup">
                    {(['normal', 'poll', 'event'] as ThreadType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={hiddenTypes.includes(type) ? 'bbFilterChip bbFilterChipMuted' : 'bbFilterChip'}
                        onClick={() => toggleHiddenType(type)}
                      >
                        {THREAD_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bbFilterSection">
                  <div className="bbFilterTitle">Tags</div>
                  <div className="bbFilterGroup">
                    {BOARD_TAGS.map((tag) => {
                      const selected = visibleTags.includes(tag.key)
                      return (
                        <button
                          key={tag.key}
                          type="button"
                          className={selected ? 'bbTagFilterChip bbTagFilterChipActive' : 'bbTagFilterChip'}
                          onClick={() => toggleVisibleTag(tag.key)}
                        >
                          <span>{tag.label}</span>
                          <span className="bbTagFilterIcon">{selected ? <XIcon /> : <PlusIcon />}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      {boardError ? <div className="errorBanner bbBoardError">{boardError}</div> : null}

      <div className="bbFeed">
        {visibleThreads.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            canInteract={Boolean(user)}
            onAuthRequired={() => setAuthPromptOpen(true)}
            onVote={handleThreadVote}
            onPollVote={handlePollVote}
          />
        ))}
        {visibleThreads.length === 0 ? <div className="bbEmptyState">No threads match the current filters.</div> : null}
      </div>

      {composerOpen ? (
        <ComposerModal canPost={Boolean(user)} onClose={() => setComposerOpen(false)} onCreate={handleCreateThread} />
      ) : null}
      {authPromptOpen ? <AuthRequiredPopup onClose={() => setAuthPromptOpen(false)} /> : null}
    </div>
  )
}

function CommentNode({
  comment,
  depth,
  canInteract,
  actionsDisabled,
  currentUserId,
  onAuthRequired,
  onVote,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: CommentSeed
  depth: number
  canInteract: boolean
  actionsDisabled: boolean
  currentUserId?: string
  onAuthRequired: () => void
  onVote: (commentId: string, value: 1 | -1) => void
  onReply: (comment: CommentSeed) => void
  onEdit: (comment: CommentSeed) => void
  onDelete: (comment: CommentSeed) => void
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const replies = comment.replies ?? []
  const cappedDepth = Math.min(depth, 3)

  return (
    <article className="bbComment" style={{ '--comment-depth': cappedDepth } as CSSProperties}>
      <div className="bbCommentBody">
        {comment.deleted ? (
          <div className="bbDeletedComment">[deleted]</div>
        ) : (
          <>
            <div className="bbMetaLine">
              <span>{comment.author}</span>
              <span>{formatDateTime(comment.createdAt)}</span>
              {comment.editedAt ? <span>Edited {formatDateTime(comment.editedAt)}</span> : null}
            </div>
            <p>{comment.body}</p>
            <div className="bbCommentActions">
              <BoardVoteButtons
                likes={comment.likes}
                dislikes={comment.dislikes}
                disabled={actionsDisabled}
                onAuthRequired={canInteract ? undefined : onAuthRequired}
                onVote={canInteract ? (value) => onVote(comment.id, value) : undefined}
              />
              <button className="bbTextButton" type="button" disabled={actionsDisabled} onClick={canInteract ? () => onReply(comment) : onAuthRequired}>
                Reply
              </button>
              {canInteract && comment.persisted && comment.authorId === currentUserId ? (
                <>
                  <button className="bbTextButton" type="button" disabled={actionsDisabled} onClick={() => onEdit(comment)}>
                    Edit
                  </button>
                  <button className="bbTextButton" type="button" disabled={actionsDisabled} onClick={() => onDelete(comment)}>
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>

      {replies.length > 0 ? (
        <div className="bbReplies">
          <button className="bbTextButton" type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
          </button>
          {expanded ? replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              canInteract={canInteract}
              actionsDisabled={actionsDisabled}
              currentUserId={currentUserId}
              onAuthRequired={onAuthRequired}
              onVote={onVote}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )) : null}
        </div>
      ) : null}
    </article>
  )
}

export function BulletinThreadPage() {
  const { threadId } = useParams()
  const { user, session } = useAuth()
  const fallbackThread = THREADS.find((item) => item.id === threadId) ?? null
  const [thread, setThread] = useState<ThreadSeed | null>(fallbackThread)
  const [threadLookupComplete, setThreadLookupComplete] = useState(Boolean(fallbackThread))
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [replyTo, setReplyTo] = useState<CommentSeed | null>(null)
  const [editingThread, setEditingThread] = useState(false)
  const [editThreadTitle, setEditThreadTitle] = useState('')
  const [editThreadBody, setEditThreadBody] = useState('')
  const [editingComment, setEditingComment] = useState<CommentSeed | null>(null)
  const [editCommentBody, setEditCommentBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!threadId) return
    const ac = new AbortController()
    setThreadError(null)
    setThreadLookupComplete(Boolean(fallbackThread))
    getBulletinThread(threadId, session?.access_token)
      .then((persisted) => {
        if (ac.signal.aborted) return
        if (persisted) setThread(mapPersistedThread(persisted))
        else setThread(fallbackThread)
        setThreadLookupComplete(true)
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        setThreadError(errorMessage(e))
        setThreadLookupComplete(true)
      })
    return () => ac.abort()
  }, [fallbackThread, session, threadId])

  if (!thread && !threadLookupComplete) {
    return (
      <div className="bbPage">
        <div className="breadcrumbs">
          <Link to="/bulletin-board">&lt; Bulletin Board</Link>
        </div>
        <div className="bbEmptyState">Loading thread...</div>
      </div>
    )
  }

  if (!thread) return <Navigate to="/bulletin-board" replace />

  const archived = thread.status === 'archived'
  const canInteract = Boolean(user) && !archived
  const canPersist = Boolean(thread.persisted && session?.access_token)
  const canEditThread = canInteract && canPersist && thread.authorId === user?.id

  async function refreshThread() {
    if (!threadId) return
    const persisted = await getBulletinThread(threadId, session?.access_token)
    if (persisted) setThread(mapPersistedThread(persisted))
  }

  function requirePersistedAction() {
    if (!user) {
      setAuthPromptOpen(true)
      return false
    }
    if (!canPersist) {
      setThreadError('This demo thread is not persisted yet. Create a real thread after applying the Bulletin Board migration.')
      return false
    }
    return true
  }

  async function handleThreadVote(value: 1 | -1) {
    if (!requirePersistedAction() || !session?.access_token) return
    setThreadError(null)
    try {
      await setBulletinThreadVote(thread!.id, value, session.access_token)
      await refreshThread()
    } catch (e: unknown) {
      setThreadError(errorMessage(e))
    }
  }

  async function handleCommentVote(commentId: string, value: 1 | -1) {
    if (!requirePersistedAction() || !session?.access_token) return
    setThreadError(null)
    try {
      await setBulletinCommentVote(commentId, value, session.access_token)
      await refreshThread()
    } catch (e: unknown) {
      setThreadError(errorMessage(e))
    }
  }

  async function submitComment(ev: FormEvent) {
    ev.preventDefault()
    if (!requirePersistedAction() || !session?.access_token) return
    const body = commentBody.trim()
    if (!body) return
    setSaving(true)
    setThreadError(null)
    try {
      await createBulletinComment(thread!.id, body, replyTo?.id ?? null, session.access_token)
      setCommentBody('')
      setReplyTo(null)
      await refreshThread()
    } catch (e: unknown) {
      setThreadError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function startThreadEdit() {
    setEditThreadTitle(thread!.title)
    setEditThreadBody(thread!.body)
    setEditingThread(true)
  }

  async function submitThreadEdit(ev: FormEvent) {
    ev.preventDefault()
    if (!requirePersistedAction() || !session?.access_token) return
    setSaving(true)
    setThreadError(null)
    try {
      await updateBulletinThread(thread!.id, {
        title: editThreadTitle.trim(),
        body: editThreadBody.trim(),
      }, session.access_token)
      setEditingThread(false)
      await refreshThread()
    } catch (e: unknown) {
      setThreadError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleThreadDelete() {
    if (!requirePersistedAction() || !session?.access_token) return
    setSaving(true)
    setThreadError(null)
    try {
      await deleteBulletinThread(thread!.id, session.access_token)
      setThread(null)
    } catch (e: unknown) {
      setThreadError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handlePollVote(pollOptionIds: string[]) {
    if (!requirePersistedAction() || !session?.access_token) return
    setThreadError(null)
    try {
      await submitBulletinPollResponse(thread!.id, pollOptionIds, session.access_token)
      await refreshThread()
    } catch (e: unknown) {
      setThreadError(errorMessage(e))
    }
  }

  function startCommentEdit(comment: CommentSeed) {
    setEditingComment(comment)
    setEditCommentBody(comment.body)
  }

  async function submitCommentEdit(ev: FormEvent) {
    ev.preventDefault()
    if (!editingComment || !requirePersistedAction() || !session?.access_token) return
    setSaving(true)
    setThreadError(null)
    try {
      await updateBulletinComment(editingComment.id, editCommentBody.trim(), session.access_token)
      setEditingComment(null)
      setEditCommentBody('')
      await refreshThread()
    } catch (e: unknown) {
      setThreadError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleCommentDelete(comment: CommentSeed) {
    if (!requirePersistedAction() || !session?.access_token) return
    setSaving(true)
    setThreadError(null)
    try {
      await deleteBulletinComment(comment.id, session.access_token)
      await refreshThread()
    } catch (e: unknown) {
      setThreadError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bbPage">
      <div className="breadcrumbs">
        <Link to="/bulletin-board">&lt; Bulletin Board</Link>
      </div>

      <article className="bbThreadDetail">
        <div className="bbThreadCardTop">
          <div className="bbThreadTaxonomy">
            <ThreadTypeBadge type={thread.type} />
            {thread.tags.length > 0 ? (
              <div className="bbTagRow">
                {thread.tags.map((tag) => (
                  <span key={tag} className="pill pillSoft">
                    {getTagLabel(tag)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="bbMetaLine bbMetaLineRight">
            <span>{thread.author}</span>
            <span>{formatDateTime(thread.createdAt)}</span>
            {thread.editedAt ? <span>Edited {formatDateTime(thread.editedAt)}</span> : null}
            {archived ? <span className="pill">Archived</span> : null}
          </div>
        </div>

        {editingThread ? (
          <form className="bbEditForm" onSubmit={submitThreadEdit}>
            <label className="field">
              <span className="fieldLabel">Title</span>
              <input value={editThreadTitle} onChange={(e) => setEditThreadTitle(e.target.value)} required />
            </label>
            <label className="field">
              <span className="fieldLabel">Body</span>
              <textarea value={editThreadBody} onChange={(e) => setEditThreadBody(e.target.value)} rows={5} required />
            </label>
            <div className="bbModalActions">
              <button className="button buttonSecondary" type="button" onClick={() => setEditingThread(false)}>
                Cancel
              </button>
              <button className="button" type="submit" disabled={saving}>
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="bbDetailTitle">{thread.title}</h1>
            <p className="bbDetailBody">{thread.body}</p>
          </>
        )}

        {thread.poll ? (
          <PollPanel
            thread={thread}
            canInteract={canInteract}
            onAuthRequired={() => setAuthPromptOpen(true)}
            onSubmit={handlePollVote}
            title="Poll"
          />
        ) : null}

        {thread.event ? (
          <section className="bbInlinePanel">
            <div className="bbInlinePanelTitle">Event</div>
            <div className="bbEventDetails">
              {thread.event.location ? <span>{thread.event.location}</span> : null}
              <span>{formatDateTime(thread.event.startsAt)}</span>
              {thread.event.endsAt ? <span>Ends {formatDateTime(thread.event.endsAt)}</span> : null}
            </div>
          </section>
        ) : null}

        <div className="bbDetailVoteRow">
          <BoardVoteButtons
            likes={thread.likes}
            dislikes={thread.dislikes}
            disabled={archived}
            onAuthRequired={canInteract ? undefined : () => setAuthPromptOpen(true)}
            onVote={canInteract ? handleThreadVote : undefined}
          />
          {canEditThread ? (
            <div className="bbOwnerActions">
              <button className="bbTextButton" type="button" onClick={startThreadEdit}>
                Edit
              </button>
              <button className="bbTextButton" type="button" onClick={handleThreadDelete} disabled={saving}>
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </article>

      {threadError ? <div className="errorBanner bbBoardError">{threadError}</div> : null}

      <section className="bbCommentsSection">
        <div className="bbCommentsHeader">
          <h2>Comments</h2>
          <span className="muted">{countComments(thread.comments)} total</span>
        </div>

        {archived ? (
          <div className="bbReadOnlyNotice">
            <span>This thread is archived. New comments and votes are disabled.</span>
          </div>
        ) : (
          <form className="bbCommentComposer" onSubmit={submitComment}>
            {replyTo ? (
              <div className="bbReplyingTo">
                Replying to {replyTo.author}
                <button className="bbTextButton" type="button" onClick={() => setReplyTo(null)}>
                  Cancel reply
                </button>
              </div>
            ) : null}
            <textarea rows={4} value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Leave a comment" onFocus={() => {
              if (!user) setAuthPromptOpen(true)
            }} />
            <div className="bbModalActions">
              <button className="button" type="submit" disabled={saving}>
                Comment
              </button>
            </div>
          </form>
        )}

        {editingComment ? (
          <form className="bbCommentComposer" onSubmit={submitCommentEdit}>
            <div className="bbReplyingTo">Editing comment</div>
            <textarea rows={4} value={editCommentBody} onChange={(e) => setEditCommentBody(e.target.value)} />
            <div className="bbModalActions">
              <button className="button buttonSecondary" type="button" onClick={() => setEditingComment(null)}>
                Cancel
              </button>
              <button className="button" type="submit" disabled={saving}>
                Save comment
              </button>
            </div>
          </form>
        ) : null}

        <div className="bbCommentList">
          {thread.comments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              depth={0}
              canInteract={canInteract}
              actionsDisabled={archived}
              currentUserId={user?.id}
              onAuthRequired={() => setAuthPromptOpen(true)}
              onVote={handleCommentVote}
              onReply={setReplyTo}
              onEdit={startCommentEdit}
              onDelete={handleCommentDelete}
            />
          ))}
          {thread.comments.length === 0 ? <div className="bbEmptyState">No comments yet.</div> : null}
        </div>
      </section>
      {authPromptOpen ? <AuthRequiredPopup onClose={() => setAuthPromptOpen(false)} /> : null}
    </div>
  )
}
