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
  endDatetime?: string | null // ISO
  address: string
  description?: string
  imagePath?: string
  organizerId?: string
  status?: 'scheduled' | 'cancelled'
  source?: string
  sourceUrl?: string
  committeeKey?: string | null
  agendaUrl?: string | null
  agendaTitle?: string | null
  agendaText?: string | null
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

export type ASICommittee = {
  key: string
  name: string
  shortName: string
  description: string
  committeeUrl: string
  eventSourceUrl: string
  eventTitleMatchers: string[]
}

export type UserProfile = {
  userId: string
  displayName: string | null
  isAsiMember: boolean
  asiMemberRole: string | null
  asiCommitteeMemberships: string[]
  asiMemberVerifiedAt: string | null
  updatedAt: string
}

export type BulletinThreadType = 'normal' | 'poll' | 'event'
export type BulletinThreadStatus = 'active' | 'hidden' | 'archived'
export type BulletinSortOrder = 'newest' | 'oldest' | 'most-upvoted' | 'most-commented'

export type BulletinTag = {
  key: string
  label: string
  tagKind: 'system' | 'committee'
  committeeKey: string | null
  active: boolean
  displayOrder: number
}

export type BulletinPollOption = {
  id: string
  threadId: string
  body: string
  position: number
  votes: number
}

export type BulletinComment = {
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
  likes: number
  dislikes: number
  replies?: BulletinComment[]
}

export type BulletinThread = {
  id: string
  authorId: string
  authorDisplayName: string
  title: string
  body: string
  threadType: BulletinThreadType
  status: BulletinThreadStatus
  pollClosesAt: string | null
  eventLocation: string | null
  eventStartsAt: string | null
  eventEndsAt: string | null
  createdAt: string
  updatedAt: string
  editedAt: string | null
  deletedAt: string | null
  tags: string[]
  likes: number
  dislikes: number
  comments: BulletinComment[]
  pollOptions: BulletinPollOption[]
  pollResponseOptionIds: string[]
}

export type BulletinBoardPreferences = {
  userId: string
  hiddenTagKeys: string[]
  hiddenThreadTypes: BulletinThreadType[]
  sortOrder: BulletinSortOrder
  updatedAt: string
}

export type CreateBulletinThreadInput = {
  title: string
  body: string
  threadType: BulletinThreadType
  tagKeys: string[]
  pollClosesAt?: string | null
  pollOptions?: string[]
  eventLocation?: string | null
  eventStartsAt?: string | null
  eventEndsAt?: string | null
}
