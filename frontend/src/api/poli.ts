import { HttpError, postgrest, supabaseFetch, supabaseFunction } from './postgrest'
import { EDUCATION_SEED, NEWS_SEED } from './seeds'
import type {
  ASICommittee,
  CodeNode,
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
