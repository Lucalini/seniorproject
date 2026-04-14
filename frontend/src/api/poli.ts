import { HttpError, postgrest, supabaseFetch, supabaseFunction } from './postgrest'
import { EDUCATION_SEED, NEWS_SEED } from './seeds'
import type {
  CodeNode,
  CreateEventInput,
  Event,
  OrdinanceDraft,
  Politician,
  TipTapDocJSON,
  UserCodeSelection,
} from '../types'

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
  const sp = new URLSearchParams()
  sp.set('select', 'uuid,title,description,datetime,address,imagePath:image_path,organizerId:organizer_id')
  sp.set('order', 'datetime.asc')
  if (params?.limit) sp.set('limit', String(params.limit))
  sp.set('datetime', `gte.${new Date().toISOString()}`)

  if (params?.q?.trim()) {
    const needle = params.q.trim().replaceAll('*', '')
    sp.set('or', `(title.ilike.*${needle}*,description.ilike.*${needle}*,address.ilike.*${needle}*)`)
  }

  return postgrest<Event[]>(`/rest/v1/events?${sp.toString()}`, {}, accessToken)
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

