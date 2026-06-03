import { ASI_COMMITTEES } from './asiCommittees'
import type { Event } from '../types'

type MeetingSlot = {
  weekday: number
  hour: number
  minute: number
  durationMinutes: number
  location: string
}

const DEFAULT_LOCATION = 'Cal Poly University Union, 1 Grand Avenue, San Luis Obispo, CA 93407'

const MEETING_SLOTS: Record<string, MeetingSlot> = {
  'asi-executive-cabinet': { weekday: 5, hour: 14, minute: 10, durationMinutes: 60, location: DEFAULT_LOCATION },
  'asi-board-of-directors': { weekday: 1, hour: 17, minute: 10, durationMinutes: 90, location: DEFAULT_LOCATION },
  'university-union-advisory-board': { weekday: 2, hour: 15, minute: 10, durationMinutes: 75, location: DEFAULT_LOCATION },
  'asi-business-finance': { weekday: 1, hour: 16, minute: 10, durationMinutes: 60, location: DEFAULT_LOCATION },
  'asi-uu-internal-review': { weekday: 2, hour: 12, minute: 10, durationMinutes: 60, location: DEFAULT_LOCATION },
  'asi-external-affairs': { weekday: 2, hour: 11, minute: 10, durationMinutes: 60, location: DEFAULT_LOCATION },
  'asi-recruitment-elections': { weekday: 3, hour: 9, minute: 10, durationMinutes: 60, location: DEFAULT_LOCATION },
  'asi-deij': { weekday: 3, hour: 16, minute: 10, durationMinutes: 60, location: DEFAULT_LOCATION },
  'student-community-liaison': { weekday: 5, hour: 15, minute: 10, durationMinutes: 60, location: DEFAULT_LOCATION },
}

function nextMeetingDate(now: Date, slot: MeetingSlot) {
  const date = new Date(now)
  date.setHours(slot.hour, slot.minute, 0, 0)

  const daysUntilSlot = (slot.weekday - date.getDay() + 7) % 7
  date.setDate(date.getDate() + daysUntilSlot)

  if (date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 7)
  }

  return date
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

export function buildCommitteeMeetingSeeds(now = new Date()): Event[] {
  return ASI_COMMITTEES.map((committee) => {
    const slot = MEETING_SLOTS[committee.key]
    const start = nextMeetingDate(now, slot)
    const end = addMinutes(start, slot.durationMinutes)

    return {
      uuid: `asi-seed-${committee.key}-${start.toISOString().slice(0, 10)}`,
      title: `${committee.shortName} Meeting`,
      datetime: start.toISOString(),
      endDatetime: end.toISOString(),
      address: slot.location,
      description: `${committee.name} meeting seeded from the ASI committee directory.`,
      imagePath: 'events/default.png',
      status: 'scheduled',
      source: 'asi_wordpress',
      sourceUrl: committee.eventSourceUrl,
      committeeKey: committee.key,
      agendaUrl: null,
      agendaTitle: null,
      agendaText: null,
    }
  })
}
