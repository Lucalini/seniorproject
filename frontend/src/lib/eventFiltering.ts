/**
 * Pure event filtering logic extracted for testability.
 * Mirrors the logic in ASICommitteePage.tsx and asiCommittees.ts.
 */

import type { ASICommittee, Event } from '../types'

export function eventMatchesCommitteeTitle(title: string, committee: ASICommittee): boolean {
  const hay = title.toLowerCase()
  return committee.eventTitleMatchers.some((matcher) => hay.includes(matcher))
}

export function eventMatchesCommittee(event: Event, committee: ASICommittee): boolean {
  if (event.committeeKey) return event.committeeKey === committee.key
  return eventMatchesCommitteeTitle(event.title, committee)
}
