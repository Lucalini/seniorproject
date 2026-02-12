import { http } from './http'
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
  if (params?.q) sp.set('q', params.q)
  if (params?.limit) sp.set('limit', String(params.limit))
  const qs = sp.toString()
  return http<Event[]>(`/api/events${qs ? `?${qs}` : ''}`)
}

export function createEvent(input: CreateEventInput) {
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

