import { HttpError, postgrest, supabaseFetch, supabaseFunction } from './postgrest'
import { EDUCATION_SEED, NEWS_SEED } from './seeds'
import type {
  ASICommittee,
  BulletinBoardPreferences,
  BulletinComment,
  BulletinPollOption,
  BulletinSortOrder,
  BulletinTag,
  BulletinThread,
  BulletinThreadType,
  CodeNode,
  CreateBulletinThreadInput,
  CreateEventInput,
  Event,
  OrdinanceDraft,
  Politician,
  TipTapDocJSON,
  UserCodeSelection,
  UserProfile,
} from '../types'
import { ASI_COMMITTEES } from '../data/asiCommittees'

const RICH_EVENT_FIELDS = [
  'uuid',
  'title',
  'description',
  'datetime',
  'endDatetime:end_datetime',
  'address',
  'imagePath:image_path',
  'organizerId:organizer_id',
  'status',
  'source',
  'sourceUrl:source_url',
  'committeeKey:committee_key',
  'agendaUrl:agenda_url',
  'agendaTitle:agenda_title',
  'agendaText:agenda_text',
].join(',')

const LEGACY_EVENT_FIELDS = 'uuid,title,description,datetime,address,imagePath:image_path,organizerId:organizer_id'

function isMissingSchemaError(e: unknown) {
  if (!(e instanceof HttpError)) return false
  const message = e.message.toLowerCase()
  return (
    (e.status === 400 || e.status === 404) &&
    (message.includes('does not exist') ||
      message.includes('could not find') ||
      message.includes('schema cache') ||
      message.includes('column') ||
      message.includes('relation'))
  )
}

function buildEventParams(params: { q?: string; limit?: number } | undefined, fields: string, includeImportedFields: boolean) {
  const sp = new URLSearchParams()
  sp.set('select', fields)
  sp.set('order', 'datetime.asc')
  if (params?.limit) sp.set('limit', String(params.limit))
  sp.set('datetime', `gte.${new Date().toISOString()}`)

  if (params?.q?.trim()) {
    const needle = params.q.trim().replaceAll('*', '')
    const searchFields = includeImportedFields
      ? `(title.ilike.*${needle}*,description.ilike.*${needle}*,address.ilike.*${needle}*,agenda_title.ilike.*${needle}*,source.ilike.*${needle}*)`
      : `(title.ilike.*${needle}*,description.ilike.*${needle}*,address.ilike.*${needle}*)`
    sp.set('or', searchFields)
  }

  return sp
}

function normalizeLegacyEvents(events: Event[]) {
  return events.map((event) => ({
    ...event,
    status: event.status ?? 'scheduled',
    source: event.source ?? 'manual',
  }))
}

export function listNews(params?: { q?: string; limit?: number; officialId?: string }) {
  const needle = params?.q?.trim().toLowerCase()
  let items = [...NEWS_SEED]

  if (params?.officialId) {
    items = items.filter((a) => (a.relatedOfficialIds ?? []).includes(params.officialId!))
  }

  if (needle) {
    items = items.filter((a) => {
      const title = a.title.toLowerCase()
      const summary = (a.summary ?? '').toLowerCase()
      const tags = (a.tags ?? []).some((t) => t.toLowerCase().includes(needle))
      return title.includes(needle) || summary.includes(needle) || tags
    })
  }

  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return Promise.resolve(items.slice(0, params?.limit ?? 25))
}

export function listEvents(params?: { q?: string; limit?: number }, accessToken?: string) {
  const richParams = buildEventParams(params, RICH_EVENT_FIELDS, true)
  return postgrest<Event[]>(`/rest/v1/events?${richParams.toString()}`, {}, accessToken)
    .then(normalizeLegacyEvents)
    .catch((e: unknown) => {
      if (!isMissingSchemaError(e)) throw e
      const legacyParams = buildEventParams(params, LEGACY_EVENT_FIELDS, false)
      return postgrest<Event[]>(`/rest/v1/events?${legacyParams.toString()}`, {}, accessToken).then(normalizeLegacyEvents)
    })
}

export function createEvent(input: CreateEventInput, accessToken?: string) {
  return supabaseFunction<Event>('create-event-geocoded', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }, accessToken)
}

export function listOfficials(params?: {
  q?: string
  level?: string
}) {
  const sp = new URLSearchParams()
  sp.set('select', 'id,name,imageObjectId:image_object_id,bio,level,phone,email')
  sp.set('order', 'name.asc')
  sp.set('limit', '200')
  if (params?.level) sp.set('level', `eq.${params.level}`)
  if (params?.q?.trim()) {
    const needle = params.q.trim().replaceAll('*', '')
    sp.set('or', `(name.ilike.*${needle}*,bio.ilike.*${needle}*)`)
  }
  return postgrest<Politician[]>(`/rest/v1/politicians?${sp.toString()}`)
}

export async function getOfficial(officialId: string) {
  const sp = new URLSearchParams()
  sp.set('select', 'id,name,imageObjectId:image_object_id,bio,level,phone,email')
  sp.set('id', `eq.${officialId}`)
  sp.set('limit', '1')
  const rows = await postgrest<Politician[]>(`/rest/v1/politicians?${sp.toString()}`)
  const row = rows[0]
  if (!row) throw new HttpError('Official not found', 404)
  return row
}

export function listEducation() {
  return Promise.resolve(EDUCATION_SEED)
}

// ── ASI Committees ──────────────────────────────────────────────────────────

type CommitteeFollowRow = { committeeKey: string }
type ProfileRow = {
  userId: string
  displayName: string | null
  isAsiMember: boolean
  asiMemberRole: string | null
  asiCommitteeMemberships: string[] | null
  asiMemberVerifiedAt: string | null
  updatedAt: string
}

function followStorageKey(userId?: string) {
  return `poli:asi-committee-follows:${userId ?? 'guest'}`
}

function readLocalFollows(userId?: string) {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(followStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeLocalFollows(keys: string[], userId?: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(followStorageKey(userId), JSON.stringify([...new Set(keys)].sort()))
}

export function listASICommittees(): Promise<ASICommittee[]> {
  return Promise.resolve(ASI_COMMITTEES)
}

export async function listCommitteeFollows(accessToken?: string, userId?: string) {
  if (!accessToken) return readLocalFollows(userId)

  const sp = new URLSearchParams()
  sp.set('select', 'committeeKey:committee_key')
  try {
    const rows = await postgrest<CommitteeFollowRow[]>(`/rest/v1/user_committee_follows?${sp}`, {}, accessToken)
    return rows.map((row) => row.committeeKey)
  } catch (e: unknown) {
    if (isMissingSchemaError(e)) return readLocalFollows(userId)
    throw e
  }
}

export async function setCommitteeFollow(
  committeeKey: string,
  following: boolean,
  accessToken?: string,
  userId?: string,
) {
  const local = new Set(readLocalFollows(userId))
  if (following) local.add(committeeKey)
  else local.delete(committeeKey)
  writeLocalFollows([...local], userId)

  if (!accessToken) return [...local].sort()

  try {
    if (following) {
      await supabaseFetch('/rest/v1/user_committee_follows', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ committee_key: committeeKey }),
      }, accessToken)
    } else {
      const sp = new URLSearchParams()
      sp.set('committee_key', `eq.${committeeKey}`)
      await supabaseFetch(`/rest/v1/user_committee_follows?${sp}`, { method: 'DELETE' }, accessToken)
    }
  } catch (e: unknown) {
    if (!isMissingSchemaError(e)) throw e
  }

  return [...local].sort()
}

export async function getUserProfile(accessToken: string): Promise<UserProfile | null> {
  const sp = new URLSearchParams()
  sp.set(
    'select',
    'userId:user_id,displayName:display_name,isAsiMember:is_asi_member,asiMemberRole:asi_member_role,asiCommitteeMemberships:asi_committee_memberships,asiMemberVerifiedAt:asi_member_verified_at,updatedAt:updated_at',
  )
  sp.set('limit', '1')

  try {
    const rows = await postgrest<ProfileRow[]>(`/rest/v1/profiles?${sp}`, {}, accessToken)
    const row = rows[0]
    if (!row) return null
    return {
      ...row,
      asiCommitteeMemberships: row.asiCommitteeMemberships ?? [],
    }
  } catch (e: unknown) {
    if (isMissingSchemaError(e)) return null
    throw e
  }
}

// ── Bulletin Board ──────────────────────────────────────────────────────────

type BulletinTagRow = {
  key: string
  label: string
  tagKind: 'system' | 'committee'
  committeeKey: string | null
  active: boolean
  displayOrder: number
}

type BulletinThreadRow = {
  id: string
  authorId: string
  authorDisplayName: string
  title: string
  body: string
  threadType: BulletinThreadType
  status: 'active' | 'hidden' | 'archived'
  pollClosesAt: string | null
  eventLocation: string | null
  eventStartsAt: string | null
  eventEndsAt: string | null
  createdAt: string
  updatedAt: string
  editedAt: string | null
  deletedAt: string | null
}

type BulletinThreadTagRow = {
  threadId: string
  tagKey: string
}

type BulletinCommentRow = {
  id: string
  threadId: string
  parentId: string | null
  authorId: string
  authorDisplayName: string
  body: string
  createdAt: string
  updatedAt: string
  editedAt: string | null
  deletedAt: string | null
}

type BulletinVoteCountRow = {
  threadId?: string
  commentId?: string
  likes: number | null
  dislikes: number | null
}

type BulletinPollOptionRow = {
  id: string
  threadId: string
  body: string
  position: number
}

type BulletinPollOptionVoteCountRow = {
  pollOptionId: string
  votes: number | null
}

type BulletinPollResponseRow = {
  id: string
  threadId: string
}

type BulletinPollResponseOptionRow = {
  responseId: string
  pollOptionId: string
}

type BulletinPreferenceRow = {
  userId: string
  hiddenTagKeys: string[] | null
  hiddenThreadTypes: BulletinThreadType[] | null
  sortOrder: BulletinSortOrder
  updatedAt: string
}

const BULLETIN_THREAD_FIELDS = [
  'id',
  'authorId:author_id',
  'authorDisplayName:author_display_name',
  'title',
  'body',
  'threadType:thread_type',
  'status',
  'pollClosesAt:poll_closes_at',
  'eventLocation:event_location',
  'eventStartsAt:event_starts_at',
  'eventEndsAt:event_ends_at',
  'createdAt:created_at',
  'updatedAt:updated_at',
  'editedAt:edited_at',
  'deletedAt:deleted_at',
].join(',')

const BULLETIN_COMMENT_FIELDS = [
  'id',
  'threadId:thread_id',
  'parentId:parent_id',
  'authorId:author_id',
  'authorDisplayName:author_display_name',
  'body',
  'createdAt:created_at',
  'updatedAt:updated_at',
  'editedAt:edited_at',
  'deletedAt:deleted_at',
].join(',')

export async function listBulletinTags(): Promise<BulletinTag[]> {
  const sp = new URLSearchParams()
  sp.set('select', 'key,label,tagKind:tag_kind,committeeKey:committee_key,active,displayOrder:display_order')
  sp.set('active', 'eq.true')
  sp.set('order', 'display_order.asc')
  return postgrest<BulletinTagRow[]>(`/rest/v1/bulletin_board_tags?${sp}`).catch((e: unknown) => {
    if (isMissingSchemaError(e)) return []
    throw e
  })
}

function nestBulletinComments(comments: BulletinComment[]): BulletinComment[] {
  const byId = new Map(comments.map((comment) => [comment.id, { ...comment, replies: [] as BulletinComment[] }]))
  const roots: BulletinComment[] = []

  for (const comment of byId.values()) {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)!.replies!.push(comment)
    } else {
      roots.push(comment)
    }
  }

  return roots
}

export async function listBulletinThreads(accessToken?: string): Promise<BulletinThread[]> {
  const sp = new URLSearchParams()
  sp.set('select', BULLETIN_THREAD_FIELDS)
  sp.set('order', 'created_at.desc')

  try {
    const threads = await postgrest<BulletinThreadRow[]>(`/rest/v1/bulletin_threads?${sp}`, {}, accessToken)
    const threadIds = threads.map((thread) => thread.id)
    if (threadIds.length === 0) return []

    const idList = `(${threadIds.join(',')})`
    const [tagRows, threadVoteRows, commentRows, commentVoteRows, pollOptions, pollOptionVoteRows] = await Promise.all([
      postgrest<BulletinThreadTagRow[]>(`/rest/v1/bulletin_thread_tags?select=threadId:thread_id,tagKey:tag_key&thread_id=in.${idList}`, {}, accessToken),
      postgrest<BulletinVoteCountRow[]>(`/rest/v1/bulletin_thread_vote_counts?select=threadId:thread_id,likes,dislikes&thread_id=in.${idList}`, {}, accessToken),
      postgrest<BulletinCommentRow[]>(`/rest/v1/bulletin_comments?select=${BULLETIN_COMMENT_FIELDS}&thread_id=in.${idList}&order=created_at.asc`, {}, accessToken),
      postgrest<BulletinVoteCountRow[]>(`/rest/v1/bulletin_comment_vote_counts?select=commentId:comment_id,likes,dislikes`, {}, accessToken),
      postgrest<BulletinPollOptionRow[]>(`/rest/v1/bulletin_poll_options?select=id,threadId:thread_id,body,position&thread_id=in.${idList}&order=position.asc`, {}, accessToken),
      postgrest<BulletinPollOptionVoteCountRow[]>('/rest/v1/bulletin_poll_option_vote_counts?select=pollOptionId:poll_option_id,votes', {}, accessToken)
        .catch((e: unknown) => {
          if (isMissingSchemaError(e)) return []
          throw e
        }),
    ])

    const tagsByThread = new Map<string, string[]>()
    for (const row of tagRows) tagsByThread.set(row.threadId, [...(tagsByThread.get(row.threadId) ?? []), row.tagKey])

    const votesByThread = new Map(threadVoteRows.map((row) => [row.threadId, row]))
    const votesByComment = new Map(commentVoteRows.map((row) => [row.commentId, row]))

    const commentsByThread = new Map<string, BulletinComment[]>()
    for (const row of commentRows) {
      const votes = votesByComment.get(row.id)
      const comment: BulletinComment = {
        ...row,
        likes: votes?.likes ?? 0,
        dislikes: votes?.dislikes ?? 0,
      }
      commentsByThread.set(row.threadId, [...(commentsByThread.get(row.threadId) ?? []), comment])
    }

    const pollVotesByOption = new Map(pollOptionVoteRows.map((row) => [row.pollOptionId, row.votes ?? 0]))
    const pollOptionsByThread = new Map<string, BulletinPollOption[]>()
    for (const row of pollOptions) {
      pollOptionsByThread.set(row.threadId, [...(pollOptionsByThread.get(row.threadId) ?? []), {
        ...row,
        votes: pollVotesByOption.get(row.id) ?? 0,
      }])
    }

    const selectedPollOptionsByThread = new Map<string, string[]>()
    if (accessToken) {
      const responses = await postgrest<BulletinPollResponseRow[]>(`/rest/v1/bulletin_poll_responses?select=id,threadId:thread_id&thread_id=in.${idList}`, {}, accessToken)
      const responseIds = responses.map((response) => response.id)
      if (responseIds.length > 0) {
        const responseIdList = `(${responseIds.join(',')})`
        const responseOptions = await postgrest<BulletinPollResponseOptionRow[]>(`/rest/v1/bulletin_poll_response_options?select=responseId:response_id,pollOptionId:poll_option_id&response_id=in.${responseIdList}`, {}, accessToken)
        const threadByResponse = new Map(responses.map((response) => [response.id, response.threadId]))
        for (const option of responseOptions) {
          const responseThreadId = threadByResponse.get(option.responseId)
          if (!responseThreadId) continue
          selectedPollOptionsByThread.set(responseThreadId, [
            ...(selectedPollOptionsByThread.get(responseThreadId) ?? []),
            option.pollOptionId,
          ])
        }
      }
    }

    return threads.map((thread) => {
      const votes = votesByThread.get(thread.id)
      return {
        ...thread,
        tags: tagsByThread.get(thread.id) ?? [],
        likes: votes?.likes ?? 0,
        dislikes: votes?.dislikes ?? 0,
        comments: nestBulletinComments(commentsByThread.get(thread.id) ?? []),
        pollOptions: pollOptionsByThread.get(thread.id) ?? [],
        pollResponseOptionIds: selectedPollOptionsByThread.get(thread.id) ?? [],
      }
    })
  } catch (e: unknown) {
    if (isMissingSchemaError(e)) return []
    throw e
  }
}

export async function getBulletinThread(threadId: string, accessToken?: string): Promise<BulletinThread | null> {
  const rows = await listBulletinThreads(accessToken)
  return rows.find((thread) => thread.id === threadId) ?? null
}

export async function createBulletinThread(input: CreateBulletinThreadInput, accessToken: string) {
  const inserted = await supabaseFetch<BulletinThreadRow[]>('/rest/v1/bulletin_threads?select=' + BULLETIN_THREAD_FIELDS, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      thread_type: input.threadType,
      poll_closes_at: input.pollClosesAt ?? null,
      event_location: input.eventLocation ?? null,
      event_starts_at: input.eventStartsAt ?? null,
      event_ends_at: input.eventEndsAt ?? null,
    }),
  }, accessToken)

  const thread = inserted[0]
  if (!thread) throw new Error('Thread insert did not return a row')

  const tagKeys = [...new Set(input.tagKeys)].slice(0, 2)
  if (tagKeys.length > 0) {
    await supabaseFetch('/rest/v1/bulletin_thread_tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tagKeys.map((tagKey) => ({ thread_id: thread.id, tag_key: tagKey }))),
    }, accessToken)
  }

  if (input.threadType === 'poll' && input.pollOptions?.length) {
    await supabaseFetch('/rest/v1/bulletin_poll_options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.pollOptions.map((body, position) => ({ thread_id: thread.id, body, position }))),
    }, accessToken)
  }

  return thread.id
}

export async function updateBulletinThread(
  threadId: string,
  input: Pick<CreateBulletinThreadInput, 'title' | 'body'>,
  accessToken: string,
) {
  await supabaseFetch(`/rest/v1/bulletin_threads?id=eq.${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      body: input.body,
    }),
  }, accessToken)
}

export async function deleteBulletinThread(threadId: string, accessToken: string) {
  await supabaseFetch(`/rest/v1/bulletin_threads?id=eq.${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  }, accessToken)
}

export async function createBulletinComment(
  threadId: string,
  body: string,
  parentId: string | null,
  accessToken: string,
) {
  await supabaseFetch('/rest/v1/bulletin_comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ thread_id: threadId, parent_id: parentId, body }),
  }, accessToken)
}

export async function updateBulletinComment(commentId: string, body: string, accessToken: string) {
  await supabaseFetch(`/rest/v1/bulletin_comments?id=eq.${encodeURIComponent(commentId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body }),
  }, accessToken)
}

export async function deleteBulletinComment(commentId: string, accessToken: string) {
  await supabaseFetch(`/rest/v1/bulletin_comments?id=eq.${encodeURIComponent(commentId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  }, accessToken)
}

export async function setBulletinThreadVote(threadId: string, value: 1 | -1, accessToken: string) {
  await supabaseFetch('/rest/v1/bulletin_thread_votes?on_conflict=thread_id,user_id', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ thread_id: threadId, value }),
  }, accessToken)
}

export async function setBulletinCommentVote(commentId: string, value: 1 | -1, accessToken: string) {
  await supabaseFetch('/rest/v1/bulletin_comment_votes?on_conflict=comment_id,user_id', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ comment_id: commentId, value }),
  }, accessToken)
}

export async function submitBulletinPollResponse(threadId: string, pollOptionIds: string[], accessToken: string) {
  const selectedOptionIds = [...new Set(pollOptionIds)].filter(Boolean)
  if (selectedOptionIds.length === 0) throw new Error('Select at least one poll option.')

  const inserted = await supabaseFetch<Array<{ id: string }>>('/rest/v1/bulletin_poll_responses?select=id', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify({ thread_id: threadId }),
  }, accessToken)

  const responseId = inserted[0]?.id
  if (!responseId) throw new Error('Poll response insert did not return a row')

  await supabaseFetch('/rest/v1/bulletin_poll_response_options', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(selectedOptionIds.map((optionId) => ({
      response_id: responseId,
      poll_option_id: optionId,
    }))),
  }, accessToken)
}

export async function getBulletinPreferences(accessToken?: string): Promise<BulletinBoardPreferences | null> {
  if (!accessToken) return null
  const sp = new URLSearchParams()
  sp.set('select', 'userId:user_id,hiddenTagKeys:hidden_tag_keys,hiddenThreadTypes:hidden_thread_types,sortOrder:sort_order,updatedAt:updated_at')
  sp.set('limit', '1')
  try {
    const rows = await postgrest<BulletinPreferenceRow[]>(`/rest/v1/bulletin_board_preferences?${sp}`, {}, accessToken)
    const row = rows[0]
    if (!row) return null
    return {
      ...row,
      hiddenTagKeys: row.hiddenTagKeys ?? [],
      hiddenThreadTypes: row.hiddenThreadTypes ?? [],
    }
  } catch (e: unknown) {
    if (isMissingSchemaError(e)) return null
    throw e
  }
}

export async function saveBulletinPreferences(
  preferences: Pick<BulletinBoardPreferences, 'hiddenTagKeys' | 'hiddenThreadTypes' | 'sortOrder'>,
  accessToken: string,
) {
  await supabaseFetch('/rest/v1/bulletin_board_preferences?on_conflict=user_id', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      hidden_tag_keys: preferences.hiddenTagKeys,
      hidden_thread_types: preferences.hiddenThreadTypes,
      sort_order: preferences.sortOrder,
    }),
  }, accessToken)
}

// ── Municipal Code ───────────────────────────────────────────────────────────

const CODE_FIELDS = 'id,parentId:parent_id,nodeType:node_type,number,heading,body,sortOrder:sort_order'

export async function listCodeTree(): Promise<CodeNode[]> {
  const sp = new URLSearchParams()
  sp.set('select', CODE_FIELDS)
  sp.set('order', 'sort_order.asc')
  const flat = await postgrest<CodeNode[]>(`/rest/v1/municipal_code_nodes?${sp}`)

  const byId = new Map<string, CodeNode>()
  const roots: CodeNode[] = []
  for (const n of flat) {
    n.children = []
    byId.set(n.id, n)
  }
  for (const n of flat) {
    if (n.parentId) {
      byId.get(n.parentId)?.children!.push(n)
    } else {
      roots.push(n)
    }
  }
  return roots
}

export function getCodeSection(sectionId: string) {
  const sp = new URLSearchParams()
  sp.set('select', CODE_FIELDS)
  sp.set('id', `eq.${sectionId}`)
  sp.set('limit', '1')
  return postgrest<CodeNode[]>(`/rest/v1/municipal_code_nodes?${sp}`)
    .then(rows => {
      if (!rows[0]) throw new HttpError('Section not found', 404)
      return rows[0]
    })
}

export function getUserSelections(accessToken?: string) {
  const sp = new URLSearchParams()
  sp.set('select', 'id,userId:user_id,nodeId:node_id,editedBody:edited_body,selected,updatedAt:updated_at')
  sp.set('selected', 'eq.true')
  return postgrest<UserCodeSelection[]>(`/rest/v1/user_code_selections?${sp}`, {}, accessToken)
}

export function upsertSelection(
  nodeId: string,
  payload: { selected: boolean; editedBody?: string | null },
  accessToken?: string,
) {
  return supabaseFetch<UserCodeSelection>(
    '/rest/v1/user_code_selections',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        node_id: nodeId,
        selected: payload.selected,
        edited_body: payload.editedBody ?? null,
        updated_at: new Date().toISOString(),
      }),
    },
    accessToken,
  )
}

const ORDINANCE_FIELDS =
  'id,userId:user_id,subject,summaryText:summary_text,reasonText:reason_text,proposedChangesJson:proposed_changes_json,updatedAt:updated_at'

export function getOrdinanceDraft(accessToken: string) {
  const sp = new URLSearchParams()
  sp.set('select', ORDINANCE_FIELDS)
  sp.set('limit', '1')
  return postgrest<OrdinanceDraft[]>(`/rest/v1/ordinance_drafts?${sp}`, {}, accessToken).then(r => r[0] ?? null)
}

export async function createOrdinanceDraft(
  payload: {
    userId: string
    subject: string
    summaryText: string
    reasonText: string
    proposedChangesJson: TipTapDocJSON
  },
  accessToken: string,
) {
  const rows = await supabaseFetch<OrdinanceDraft[]>(
    '/rest/v1/ordinance_drafts',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: payload.userId,
        subject: payload.subject,
        summary_text: payload.summaryText,
        reason_text: payload.reasonText,
        proposed_changes_json: payload.proposedChangesJson,
      }),
    },
    accessToken,
  )
  return rows[0]
}

export function updateOrdinanceDraft(
  id: string,
  payload: Partial<{
    subject: string
    summaryText: string
    reasonText: string
    proposedChangesJson: TipTapDocJSON
  }>,
  accessToken: string,
) {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (payload.subject !== undefined) body.subject = payload.subject
  if (payload.summaryText !== undefined) body.summary_text = payload.summaryText
  if (payload.reasonText !== undefined) body.reason_text = payload.reasonText
  if (payload.proposedChangesJson !== undefined) body.proposed_changes_json = payload.proposedChangesJson

  const sp = new URLSearchParams()
  sp.set('id', `eq.${id}`)
  return supabaseFetch<OrdinanceDraft[]>(
    `/rest/v1/ordinance_drafts?${sp}`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    },
    accessToken,
  ).then(rows => rows[0])
}

export type SummarizeSectionInput = { number: string; heading: string; body: string }

export function summarizeCodeSections(sections: SummarizeSectionInput[], accessToken: string) {
  return supabaseFunction<{ summary: string }>(
    'summarize-municipal-sections',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sections }),
    },
    accessToken,
  )
}
