export type NewsArticle = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string // ISO
  summary?: string
  tags?: string[]
  relatedOfficialIds?: string[]
}

export type Event = {
  id: string
  title: string
  startsAt: string // ISO
  locationName?: string
  address?: string
  description?: string
  link?: string
  createdBy?: 'community' | 'imported'
}

export type CreateEventInput = {
  title: string
  startsAt: string // ISO
  locationName?: string
  address?: string
  description?: string
  link?: string
}

export type Official = {
  id: string
  name: string
  roleTitle: string
  areaServed: string
  level?: 'city' | 'county' | 'state' | 'federal' | 'other'
  officeAddress?: string
  phone?: string
  email?: string
  website?: string
}

export type EducationTopic = {
  id: string
  title: string
  description: string
  bullets: string[]
}

