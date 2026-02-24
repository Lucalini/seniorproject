import { http } from './http'
import { postgrest } from './postgrest'
import type { CreateEventInput, EducationTopic, Event, NewsArticle, Politician } from '../types'

export function listNews(params?: { q?: string; limit?: number; officialId?: string }) {
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.limit) sp.set('limit', String(params.limit))
  if (params?.officialId) sp.set('officialId', params.officialId)
  const qs = sp.toString()
  return http<NewsArticle[]>(`/api/news${qs ? `?${qs}` : ''}`)
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
  // Use the existing backend endpoint to geocode + create geo point via RPC.
  return http<Event>('/api/events', { method: 'POST', body: input })
}

export function listOfficials(params?: {
  q?: string
  level?: string
}) {
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.level) sp.set('level', params.level)
  const qs = sp.toString()
  return http<Politician[]>(`/api/officials${qs ? `?${qs}` : ''}`)
}

export function getOfficial(officialId: string) {
  return http<Politician>(`/api/officials/${encodeURIComponent(officialId)}`)
}

export function listEducation() {
  return http<EducationTopic[]>('/api/education')
}

