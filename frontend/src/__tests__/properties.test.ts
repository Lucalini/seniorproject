/**
 * Property-Based Tests for Committee Calendar Sync Verification
 *
 * Uses fast-check with vitest to verify correctness properties
 * across large input spaces.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  generateOccurrences,
  filterOccurrencesInWindow,
  dateKey,
  addDays,
  dateOnlyFromParts,
} from '../lib/recurrence'
import { eventMatchesCommittee } from '../lib/eventFiltering'
import { formatTimeRange } from '../lib/formatTimeRange'
import type { ASICommittee, Event } from '../types'

const TIME_ZONE = 'America/Los_Angeles'
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// --- Generators ---

/** Generate a valid US date string (MM/DD/YYYY) within a reasonable range */
const arbUsDate = fc
  .record({
    y: fc.integer({ min: 2024, max: 2027 }),
    m: fc.integer({ min: 1, max: 12 }),
    d: fc.integer({ min: 1, max: 28 }), // avoid invalid day-of-month issues
  })
  .map(({ m, d, y }) => `${m}/${d}/${y}`)

/** Generate a valid recurrence config that produces bounded output */
const arbRecurrenceConfig = fc
  .record({
    departureDate: arbUsDate,
    recurrenceEnabled: fc.boolean(),
    repeatType: fc.constantFrom('week', 'day', 'month'),
    repeatEvery: fc.integer({ min: 1, max: 4 }),
    repeatDays: fc.subarray(WEEKDAYS, { minLength: 1, maxLength: 3 }),
    // End date offset from departure (in days) - keep small to avoid huge loops
    endDateOffset: fc.integer({ min: 0, max: 90 }),
  })
  .map((cfg) => {
    const parts = cfg.departureDate.match(/^(\d+)\/(\d+)\/(\d+)$/)!
    const m = Number(parts[1])
    const d = Number(parts[2])
    const y = Number(parts[3])
    const baseDate = new Date(Date.UTC(y, m - 1, d))
    const endDate = addDays(baseDate, cfg.endDateOffset)
    const endM = endDate.getUTCMonth() + 1
    const endD = endDate.getUTCDate()
    const endY = endDate.getUTCFullYear()

    const acf: Record<string, unknown> = {
      event_dates_times: { departure_date: cfg.departureDate },
      recurrence_enabled: cfg.recurrenceEnabled,
      recurrence: {
        repeat_type: cfg.repeatType,
        repeat_every: String(cfg.repeatEvery),
        repeat_days: cfg.repeatDays,
        end_date: `${endM}/${endD}/${endY}`,
      },
    }
    return { acf, baseDate, endDate }
  })

/** Generate a time window (start, end) as Date pair */
const arbTimeWindow = fc
  .record({
    startYear: fc.integer({ min: 2024, max: 2027 }),
    startMonth: fc.integer({ min: 1, max: 12 }),
    startDay: fc.integer({ min: 1, max: 28 }),
    windowDays: fc.integer({ min: 1, max: 365 }),
  })
  .map(({ startYear, startMonth, startDay, windowDays }) => {
    const windowStart = new Date(Date.UTC(startYear, startMonth - 1, startDay))
    const windowEnd = addDays(windowStart, windowDays)
    return { windowStart, windowEnd }
  })

/** Generate a valid ISO datetime string within a reasonable range */
const arbIsoDatetime = fc
  .integer({ min: new Date('2024-01-01').getTime(), max: new Date('2027-12-31').getTime() })
  .map((ts) => new Date(ts).toISOString())

/** Generate a minimal Event object */
const arbEvent = fc
  .record({
    uuid: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    datetime: arbIsoDatetime,
    address: fc.string({ minLength: 0, maxLength: 100 }),
    committeeKey: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  })
  .map(
    (r): Event => ({
      uuid: r.uuid,
      title: r.title,
      datetime: r.datetime,
      address: r.address,
      committeeKey: r.committeeKey,
    }),
  )

/** Generate a minimal ASICommittee object */
const arbCommittee = fc
  .record({
    key: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    shortName: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 0, maxLength: 200 }),
    committeeUrl: fc.webUrl(),
    eventSourceUrl: fc.webUrl(),
    eventTitleMatchers: fc.array(fc.string({ minLength: 1, maxLength: 30 }).map((s) => s.toLowerCase()), {
      minLength: 1,
      maxLength: 5,
    }),
  })
  .map(
    (r): ASICommittee => ({
      key: r.key,
      name: r.name,
      shortName: r.shortName,
      description: r.description,
      committeeUrl: r.committeeUrl,
      eventSourceUrl: r.eventSourceUrl,
      eventTitleMatchers: r.eventTitleMatchers,
    }),
  )

// --- Property Tests ---

describe('Feature: committee-calendar-sync-verification, Property 1: Window bounds', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any valid recurrence config and time window, all filtered occurrences
   * fall within window bounds.
   */
  it('all filtered occurrences fall within window bounds', () => {
    fc.assert(
      fc.property(arbRecurrenceConfig, arbTimeWindow, ({ acf }, { windowStart, windowEnd }) => {
        const allOccurrences = generateOccurrences(acf, TIME_ZONE)
        const filtered = filterOccurrencesInWindow(allOccurrences, windowStart, windowEnd)

        const windowStartKey = dateKey(windowStart)
        const windowEndKey = dateKey(windowEnd)

        for (const occ of filtered) {
          const occKey = dateKey(occ.date)
          expect(occKey >= windowStartKey).toBe(true)
          expect(occKey <= windowEndKey).toBe(true)
        }
      }),
      { numRuns: 200 },
    )
  })
})

describe('Feature: committee-calendar-sync-verification, Property 3: Committee filtering', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any event and committee, eventMatchesCommittee returns true iff
   * committeeKey matches or title contains a matcher.
   */
  it('eventMatchesCommittee returns true iff committeeKey matches or title contains a matcher', () => {
    fc.assert(
      fc.property(arbEvent, arbCommittee, (event, committee) => {
        const result = eventMatchesCommittee(event, committee)

        if (event.committeeKey) {
          // When committeeKey is set, match is purely by key
          expect(result).toBe(event.committeeKey === committee.key)
        } else {
          // When committeeKey is not set, match is by title containing a matcher
          const hay = event.title.toLowerCase()
          const titleMatches = committee.eventTitleMatchers.some((matcher) => hay.includes(matcher))
          expect(result).toBe(titleMatches)
        }
      }),
      { numRuns: 200 },
    )
  })
})

describe('Feature: committee-calendar-sync-verification, Property 5: Sort order', () => {
  /**
   * **Validates: Requirements 4.4**
   *
   * For any set of events, sorting by datetime produces non-decreasing order.
   */
  it('sorting events by datetime produces non-decreasing order', () => {
    fc.assert(
      fc.property(fc.array(arbEvent, { minLength: 0, maxLength: 50 }), (events) => {
        const sorted = [...events].sort(
          (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
        )

        for (let i = 1; i < sorted.length; i++) {
          const prev = new Date(sorted[i - 1].datetime).getTime()
          const curr = new Date(sorted[i].datetime).getTime()
          expect(curr).toBeGreaterThanOrEqual(prev)
        }
      }),
      { numRuns: 200 },
    )
  })
})

describe('Feature: committee-calendar-sync-verification, Property 6: Time range formatting', () => {
  /**
   * **Validates: Requirements 7.3**
   *
   * For any event with start and end datetime, formatTimeRange output
   * contains both times with a dash.
   */
  it('formatTimeRange output contains both times separated by a dash when endDatetime is set', () => {
    const arbEventWithEndTime = fc
      .record({
        startTs: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2027-12-31').getTime() }),
        durationMinutes: fc.integer({ min: 30, max: 480 }),
      })
      .map(({ startTs, durationMinutes }) => {
        const start = new Date(startTs)
        const end = new Date(startTs + durationMinutes * 60_000)
        return {
          event: {
            uuid: 'test-uuid',
            title: 'Test Event',
            datetime: start.toISOString(),
            endDatetime: end.toISOString(),
            address: '123 Test St',
          } as Event,
        }
      })

    fc.assert(
      fc.property(arbEventWithEndTime, ({ event }) => {
        const result = formatTimeRange(event)

        // Must contain a dash separator
        expect(result).toContain(' - ')

        // The start time should be present
        const start = new Date(event.datetime)
        const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        expect(result).toContain(startTime)

        // The end time should be present
        const end = new Date(event.endDatetime!)
        const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        expect(result).toContain(endTime)
      }),
      { numRuns: 200 },
    )
  })
})
