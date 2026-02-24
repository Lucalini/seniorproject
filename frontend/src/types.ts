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
  uuid: string
  title: string
  datetime: string // ISO
  address: string
  description?: string
  imagePath?: string
  organizerId?: string
}

export type CreateEventInput = {
  title: string
  datetime: string // ISO
  address: string
  description: string
  imagePath?: string
  organizerId?: string
}

export type Politician = {
  id: string
  name: string
  imageObjectId?: string
  bio?: string
  level?: string
  phone?: string
  email?: string
}

export type EducationTopic = {
  id: string
  title: string
  description: string
  bullets: string[]
}

