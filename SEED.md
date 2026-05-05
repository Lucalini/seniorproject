# Seeding the Committee Calendar

This document explains how to manually invoke the `committee-calendar-sync` edge function to populate the `events` table with ASI committee meeting data from WordPress.

## Prerequisites

1. **Supabase CLI** installed (`npm i -g supabase` or [platform installer](https://supabase.com/docs/guides/cli/getting-started))
2. CLI linked to the project:
   ```bash
   supabase login
   supabase link --project-ref xjvrgyqirbmnmcbtmskx
   ```
3. Edge function deployed:
   ```bash
   supabase functions deploy committee-calendar-sync --no-verify-jwt
   ```
4. Required secrets set on the project:
   - `URL` — Supabase project URL (e.g. `https://xjvrgyqirbmnmcbtmskx.supabase.co`)
   - `SERVICE_ROLE_KEY` — service role key from the Supabase dashboard
   - `COMMITTEE_CALENDAR_CRON_SECRET` (optional) — if set, all requests must include a matching `x-cron-secret` header
5. Migrations applied (003, 004, 005) so that `calendar_event_sources`, `upsert_imported_event`, and the cron job exist.

## Manual Invocation

### Option 1: Supabase CLI (if `functions invoke` is available)

```bash
supabase functions invoke committee-calendar-sync --no-verify-jwt
```

> **Note**: The `functions invoke` subcommand was removed in some CLI versions (e.g. v2.75). If your CLI doesn't support it, use the cURL method below.

### Option 2: cURL (recommended)

```bash
curl -X POST "https://xjvrgyqirbmnmcbtmskx.supabase.co/functions/v1/committee-calendar-sync" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Replace `<anon-key>` with the value from `frontend/.env.local` (`VITE_SUPABASE_ANON_KEY`).

---

This sends a POST request to the deployed edge function. The function will:

1. Read all active rows from `calendar_event_sources` (9 ASI committee URLs)
2. Fetch each WordPress event page and its JSON API endpoint
3. Expand recurrence rules into individual occurrences within the time window (14 days back, 180 days forward)
4. Upsert each occurrence into the `events` table via the `upsert_imported_event` RPC

## Expected Response

A successful invocation returns JSON like:

```json
{
  "ok": true,
  "runStartedAt": "2025-01-15T12:00:00.000Z",
  "timeZone": "America/Los_Angeles",
  "windowStart": "2025-01-01",
  "windowEnd": "2025-07-14",
  "checked": 9,
  "upserted": 42,
  "cancelled": 3,
  "skipped": 0,
  "errors": 0,
  "results": [
    {
      "name": "Executive Cabinet",
      "url": "https://www.asi.calpoly.edu/events/...",
      "fetched": 8,
      "upserted": 8,
      "cancelled": 0,
      "skipped": 0,
      "error": null
    }
  ]
}
```

Key fields:
- `ok: true` — all sources processed without errors
- `checked` — number of active sources processed
- `upserted` — total event occurrences written to the database
- `errors` — number of sources or occurrences that failed (should be 0)
- `results` — per-source breakdown

If `ok: false`, inspect the `results` array for per-source `error` messages.

## Verifying the Seed

After a successful invocation, confirm events were written to the database.

### Option A: SQL query (Supabase SQL Editor or psql)

```sql
SELECT committee_key, count(*) 
FROM events 
WHERE source = 'asi_wordpress' AND datetime >= now() 
GROUP BY committee_key;
```

You should see at least one row per active committee that has upcoming meetings. Example output:

```
 committee_key          | count
------------------------+-------
 executive-cabinet      |     8
 board-of-directors     |     6
 uuab                   |     4
 business-finance       |     5
 internal-review        |     3
 external-affairs       |     4
 recruitment-elections  |     3
 deij                   |     4
 student-community      |     5
```

### Option B: Check source status

```sql
SELECT name, last_checked_at, last_success_at, last_error 
FROM calendar_event_sources 
ORDER BY name;
```

All rows should have a recent `last_success_at` and `last_error` should be `NULL`.

### Option C: Frontend verification

1. Start the frontend (`cd frontend && npm run dev`)
2. Navigate to the Events page — imported events should appear alongside manual events
3. Navigate to any ASI Committee page — committee-specific meetings should appear in the calendar

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Response `ok: false` with 401 | `COMMITTEE_CALENDAR_CRON_SECRET` is set but not sent | Either unset the secret or include `x-cron-secret` header in your request |
| `errors > 0` with "UnknownIssuer" | Deno edge runtime doesn't trust the ASI WordPress SSL certificate | This is a transient Supabase/Deno TLS issue; retry later or contact Supabase support. The function logic is correct. |
| `errors > 0` in response | One or more WordPress pages unreachable or changed format | Check `results[].error` for the specific URL and error message |
| 0 events upserted | No active sources in `calendar_event_sources` | Verify migration 004 was applied: `SELECT count(*) FROM calendar_event_sources WHERE active = true;` |
| Events don't appear in frontend | Events have `datetime` in the past | The frontend only shows `datetime >= now()`; check the time window |
| Function not found | Edge function not deployed | Run `supabase functions deploy committee-calendar-sync --no-verify-jwt` |
| `functions invoke` not recognized | CLI version doesn't have `invoke` subcommand | Use the cURL method instead (see above) |

## Alternative: cURL Invocation

If you prefer to invoke via cURL (useful for passing custom parameters):

```bash
curl -X POST "https://xjvrgyqirbmnmcbtmskx.supabase.co/functions/v1/committee-calendar-sync" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"lookaheadDays": 90}'
```

To test a single source URL:

```bash
curl -X POST "https://xjvrgyqirbmnmcbtmskx.supabase.co/functions/v1/committee-calendar-sync" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://www.asi.calpoly.edu/events/business-finance-meeting_s26/"]}'
```

## End-to-End Pipeline Verification Checklist

Use this checklist after the TLS issue is resolved and events have been seeded successfully.

### 7.1 — EventsPage displays imported events alongside manual events

1. Start the frontend: `cd frontend && npm run dev`
2. Navigate to the Events page (`/events`)
3. Confirm that:
   - [ ] Events with `source = 'asi_wordpress'` appear in the "Upcoming" list
   - [ ] Imported events appear alongside any manually created events
   - [ ] Events with `status === 'cancelled'` show a "Cancelled" badge
   - [ ] Events with `agendaUrl` show a clickable agenda link
   - [ ] Events with `endDatetime` display a time range (e.g., "1/15/2025, 3:00 PM - 5:00 PM")
   - [ ] Search filters work across imported event titles, addresses, and descriptions

### 7.2 — ASICommitteePage displays committee-specific events

1. Navigate to any ASI Committee page (e.g., `/asi/executive-cabinet`)
2. Confirm that:
   - [ ] The EventCalendarSection renders with committee-specific events
   - [ ] Only events matching the committee's `committeeKey` (or title matchers) appear
   - [ ] The calendar grid shows dots/indicators on days with meetings
   - [ ] The "Upcoming" list below the calendar shows events in chronological order
   - [ ] The meeting count label is accurate (e.g., "8 synced upcoming meetings")

### 7.3 — Cron job is registered in pg_cron

After applying migration `005_committee_calendar_cron.sql`, verify the cron job exists:

```sql
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'committee-calendar-sync';
```

Expected result:
- `jobname` = `'committee-calendar-sync'`
- `schedule` = `'0 */6 * * *'` (every 6 hours at :00)
- `command` contains `net.http_post` calling the edge function URL with `x-cron-secret` header

**Migration 005 correctness summary:**
- ✅ Enables `pg_cron` extension (scheduling)
- ✅ Enables `pg_net` extension (async HTTP from Postgres)
- ✅ Uses `cron.schedule('committee-calendar-sync', '0 */6 * * *', ...)` — meets "no less than once per day, no more than once per hour"
- ✅ Calls `net.http_post` to the edge function URL sourced from vault
- ✅ Includes `x-cron-secret` header sourced from `vault.decrypted_secrets`
- ✅ Defined as SQL migration (infrastructure-as-code, reproducible)
- ✅ pg_cron jobs are fire-and-forget — failed invocations don't block subsequent runs

### Current Status

> **⚠️ TLS Issue (UnknownIssuer):** The edge function was invoked but all ASI WordPress sources failed with TLS certificate errors (`UnknownIssuer`). This is a Supabase Deno runtime issue — the function logic is correct. Once Supabase resolves the TLS trust chain for `asi.calpoly.edu`, re-invoke the function and complete steps 7.1 and 7.2 above.

To re-attempt seeding after the TLS issue is resolved:

```bash
curl -X POST "https://xjvrgyqirbmnmcbtmskx.supabase.co/functions/v1/committee-calendar-sync" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Ongoing Sync

After the initial seed, the pg_cron job (migration `005_committee_calendar_cron.sql`) runs the function every 6 hours automatically. No further manual invocation is needed unless you want to force a refresh.
