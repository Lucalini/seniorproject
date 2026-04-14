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

export type CodeNode = {
  id: string
  parentId: string | null
  nodeType: 'title' | 'chapter' | 'section'
  number: string
  heading: string
  body: string | null
  sortOrder: number
  children?: CodeNode[]
}

export type UserCodeSelection = {
  id: string
  userId: string
  nodeId: string
  editedBody: string | null
  selected: boolean
  updatedAt: string
}

/** TipTap / ProseMirror JSON stored in ordinance_drafts.proposed_changes_json */
export type TipTapDocJSON = Record<string, unknown>

export type OrdinanceDraft = {
  id: string
  userId: string
  subject: string
  summaryText: string
  reasonText: string
  proposedChangesJson: TipTapDocJSON
  updatedAt: string
}

