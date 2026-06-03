import { describe, expect, it } from 'vitest'
import { ASI_COMMITTEES } from '../data/asiCommittees'
import { buildCommitteeMeetingSeeds } from '../data/committeeMeetingSeeds'

describe('committee meeting seeds', () => {
  it('creates one upcoming meeting for every ASI committee', () => {
    const now = new Date('2026-06-03T12:00:00-07:00')
    const seeds = buildCommitteeMeetingSeeds(now)

    expect(seeds).toHaveLength(ASI_COMMITTEES.length)

    const seededKeys = new Set(seeds.map((event) => event.committeeKey))
    for (const committee of ASI_COMMITTEES) {
      expect(seededKeys.has(committee.key)).toBe(true)
    }

    for (const event of seeds) {
      expect(new Date(event.datetime).getTime()).toBeGreaterThan(now.getTime())
      expect(event.source).toBe('asi_wordpress')
      expect(event.status).toBe('scheduled')
    }
  })
})
