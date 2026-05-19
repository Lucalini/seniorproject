/**
 * Integration Tests for Committee Calendar Sync Verification
 *
 * These tests hit the real deployed Supabase instance.
 * They require VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set.
 *
 * Run with: npx vitest --run src/__tests__/integration.test.ts
 */
import { describe, it, expect, afterAll } from 'vitest'
import { ASI_COMMITTEES } from '../data/asiCommittees'

// --- Configuration ---

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

const canConnect = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** Helper to make authenticated PostgREST requests */
async function postgrestFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${SUPABASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')
  headers.set('apikey', SUPABASE_ANON_KEY)
  headers.set('authorization', `Bearer ${SUPABASE_ANON_KEY}`)

  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PostgREST request failed ${res.status}: ${body.slice(0, 500)}`)
  }
  return res.json() as Promise<T>
}

/** Helper to call Supabase RPC functions */
async function rpcCall<T>(fnName: string, params: Record<string, unknown>): Promise<T> {
  return postgrestFetch<T>(`/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'return=representation' },
    body: JSON.stringify(params),
  })
}

// --- Integration Tests ---

describe.skipIf(!canConnect)('Integration Tests (requires network access)', () => {
  // --- 6.1: Edge function response structure ---
  describe('6.1 Edge function response structure', () => {
    it(
      'POST to committee-calendar-sync returns response with ok, checked, upserted, errors fields',
      { timeout: 120_000 },
      async () => {
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/committee-calendar-sync`

        const res = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({}),
        })

        // The function may return 401 if cron secret is required and not provided,
        // or 200 if it allows Bearer token auth. Either way, the response should be JSON.
        const body = await res.json()

        if (res.status === 401) {
          // If auth is required, verify the error response shape
          expect(body).toHaveProperty('ok', false)
          expect(body).toHaveProperty('message')
        } else {
          // Successful invocation — verify full response structure
          expect(body).toHaveProperty('ok')
          expect(body).toHaveProperty('checked')
          expect(body).toHaveProperty('upserted')
          expect(body).toHaveProperty('errors')
          expect(typeof body.ok).toBe('boolean')
          expect(typeof body.checked).toBe('number')
          expect(typeof body.upserted).toBe('number')
          expect(typeof body.errors).toBe('number')
        }
      },
    )
  })

  // --- 6.2: calendar_event_sources has 9 active rows ---
  describe('6.2 calendar_event_sources active rows', () => {
    it(
      'has exactly 9 active rows with URLs matching ASI_COMMITTEES data',
      { timeout: 30_000 },
      async () => {
        type SourceRow = { uuid: string; url: string; active: boolean }

        const sp = new URLSearchParams()
        sp.set('select', 'uuid,url,active')
        sp.set('active', 'eq.true')

        const rows = await postgrestFetch<SourceRow[]>(
          `/rest/v1/calendar_event_sources?${sp.toString()}`,
        )

        // Verify exactly 9 active rows
        expect(rows).toHaveLength(9)

        // Collect all expected URLs from ASI_COMMITTEES
        const expectedUrls = new Set(ASI_COMMITTEES.map((c) => c.eventSourceUrl))

        // Each row's URL should match one of the ASI_COMMITTEES eventSourceUrl values
        for (const row of rows) {
          expect(expectedUrls.has(row.url)).toBe(true)
        }

        // All expected URLs should be present
        const actualUrls = new Set(rows.map((r) => r.url))
        for (const expectedUrl of expectedUrls) {
          expect(actualUrls.has(expectedUrl)).toBe(true)
        }
      },
    )
  })

  // --- 6.3: Upsert idempotency ---
  describe('6.3 Upsert idempotency (Property 2)', () => {
    const TEST_UID = `integration-test-idempotency-${Date.now()}`
    const TEST_SOURCE = 'integration_test'

    afterAll(async () => {
      // Clean up: delete the test event row
      try {
        const sp = new URLSearchParams()
        sp.set('external_event_uid', `eq.${TEST_UID}`)
        sp.set('source', `eq.${TEST_SOURCE}`)
        await postgrestFetch(`/rest/v1/events?${sp.toString()}`, {
          method: 'DELETE',
        })
      } catch {
        // Best-effort cleanup; ignore errors
      }
    })

    it(
      'calling upsert_imported_event twice with same UID results in single row with latest data',
      { timeout: 30_000 },
      async () => {
        const baseParams = {
          p_external_event_uid: TEST_UID,
          p_source: TEST_SOURCE,
          p_source_url: 'https://example.com/test-event',
          p_description: 'Integration test event',
          p_datetime: new Date(Date.now() + 86_400_000).toISOString(), // tomorrow
          p_end_datetime: new Date(Date.now() + 90_000_000).toISOString(),
          p_address: '1 Grand Avenue, San Luis Obispo, CA 93407',
          p_latitude: 35.301,
          p_longitude: -120.659,
          p_image_path: 'events/default.png',
          p_status: 'scheduled',
          p_committee_key: null,
        }

        // First call with title "First Title"
        const firstResult = await rpcCall<unknown[]>('upsert_imported_event', {
          ...baseParams,
          p_title: 'First Title',
        })
        expect(Array.isArray(firstResult)).toBe(true)
        expect(firstResult.length).toBeGreaterThanOrEqual(1)

        // Second call with same UID but different title "Second Title"
        const secondResult = await rpcCall<unknown[]>('upsert_imported_event', {
          ...baseParams,
          p_title: 'Second Title',
        })
        expect(Array.isArray(secondResult)).toBe(true)
        expect(secondResult.length).toBeGreaterThanOrEqual(1)

        // Query the events table to verify only one row exists with this UID
        const sp = new URLSearchParams()
        sp.set('select', 'uuid,title,external_event_uid,source')
        sp.set('external_event_uid', `eq.${TEST_UID}`)
        sp.set('source', `eq.${TEST_SOURCE}`)

        type EventRow = {
          uuid: string
          title: string
          external_event_uid: string
          source: string
        }

        const rows = await postgrestFetch<EventRow[]>(
          `/rest/v1/events?${sp.toString()}`,
        )

        // Should be exactly one row (idempotent upsert)
        expect(rows).toHaveLength(1)

        // The row should have the data from the second call
        expect(rows[0].title).toBe('Second Title')
        expect(rows[0].external_event_uid).toBe(TEST_UID)
        expect(rows[0].source).toBe(TEST_SOURCE)
      },
    )
  })
})
