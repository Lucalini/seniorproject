import { HttpError, postgrest, supabaseFunction } from './postgrest'
import { EDUCATION_SEED, NEWS_SEED } from './seeds'
import type { CreateEventInput, EducationTopic, Event, NewsArticle, Politician } from '../types'

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

export function listEvents(params?: { q?: string; limit?: number }) {
  const sp = new URLSearchParams()
  // Field aliasing keeps the frontend in camelCase.
  sp.set('select', 'uuid,title,description,datetime,address,imagePath:image_path,organizerId:organizer_id')
  sp.set('order', 'datetime.asc')
  if (params?.limit) sp.set('limit', String(params.limit))
  // Upcoming only (optional)
  sp.set('datetime', `gte.${new Date().toISOString()}`)

  if (params?.q?.trim()) {
    const needle = params.q.trim().replaceAll('*', '') // basic safety
    // Match title OR description OR address
    sp.set('or', `(title.ilike.*${needle}*,description.ilike.*${needle}*,address.ilike.*${needle}*)`)
  }

  return postgrest<Event[]>(`/rest/v1/events?${sp.toString()}`)
}

export function createEvent(input: CreateEventInput) {
  return supabaseFunction<Event>('create-event-geocoded', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
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

