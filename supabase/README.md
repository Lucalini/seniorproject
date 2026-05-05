## Supabase Edge Function: Mobilize SLO scraper

This project includes an Edge Function (`mobilize-slo-scrape`) that fetches upcoming **in-person** events near San Luis Obispo from Mobilize and inserts new ones into the `events` table by calling your existing Postgres RPC `create_event`.

It uses Mobilize's public JSON API (`https://api.mobilize.us/v1/events`) with `zipcode`/`max_dist` filtering (per MobilizeAmerica API docs: `https://github.com/mobilizeamerica/api`).

### 1) Deploy the Edge Function

From the repo root (after `supabase login` and `supabase link`):

```bash
supabase functions deploy mobilize-slo-scrape --no-verify-jwt
```

### 2) Set Edge Function secrets

In your Supabase project, set these secrets for the function runtime:

- `URL`
- `SERVICE_ROLE_KEY`
- `MOBILIZE_ZIPCODE` (default: `93401`)
- `MOBILIZE_MAX_DIST_MILES` (default: `50`)
- `MOBILIZE_PER_PAGE` (default: `50`)
- `MOBILIZE_MAX_PAGES` (default: `10`)
- `MOBILIZE_CRON_SECRET` (recommended)

Example (CLI):

```bash
supabase secrets set \
  URL="https://<project-ref>.supabase.co" \
  SERVICE_ROLE_KEY="<service-role-key>" \
  MOBILIZE_ZIPCODE="93401" \
  MOBILIZE_MAX_DIST_MILES="50" \
  MOBILIZE_CRON_SECRET="<random-string>"
```

### 3) Schedule it to run every morning

Supabase schedules Edge Functions using `pg_cron` + `pg_net` (see: `https://supabase.com/docs/guides/functions/schedule-functions`).

Recommended: store secrets in Vault, then schedule an HTTP call to the Edge Function.

Run this SQL in the Supabase SQL editor (adjust the cron expression to your preferred time; cron runs in UTC):

```sql
-- one-time: enable required extensions (Dashboard -> Database -> Extensions)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- one-time: store secrets
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<your MOBILIZE_CRON_SECRET>', 'mobilize_cron_secret');

-- daily run at 7am America/Los_Angeles == 15:00 UTC (standard time)
select
  cron.schedule(
    'mobilize-slo-scrape-daily',
    '0 15 * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
              || '/functions/v1/mobilize-slo-scrape',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mobilize_cron_secret')
        ),
        body := jsonb_build_object('source', 'pg_cron', 'ts', now())
      );
    $$
  );
```

Notes:

- Cron is UTC and daylight-savings will shift the local time unless you adjust the schedule.
- The function dedupes by `(title, address)` before inserting (only one row per Mobilize event).

---

## Supabase Edge Function: committee-calendar-sync

This Edge Function populates the global calendar from the ASI committee event URLs in `calendar_event_sources`.
It reads each ASI WordPress event page, follows the advertised WordPress JSON endpoint, expands recurrences,
tracks cancellation exceptions, and upserts rows into `events` using `external_event_uid`.

The migrations `003_committee_calendar_events.sql` and `004_asi_committees_and_user_profiles.sql` add:

- imported-event metadata on `events` (`source_url`, `external_event_uid`, `status`, `agenda_url`, `agenda_title`, `last_seen_at`, etc.)
- `calendar_event_sources` with the initial ASI committee URL list
- `asi_committees` with the committee descriptions and source URLs
- `profiles` with ASI membership fields
- `user_committee_follows` so each user can track committees
- `upsert_imported_event(...)` for idempotent inserts/updates with geography

### 1) Deploy the Edge Function

```bash
supabase functions deploy committee-calendar-sync --no-verify-jwt
```

### 2) Set Edge Function secrets

Required:

- `URL`
- `SERVICE_ROLE_KEY`

Recommended:

- `COMMITTEE_CALENDAR_CRON_SECRET` — shared secret required in the `x-cron-secret` header
- `ASI_CALENDAR_TIME_ZONE` — defaults to `America/Los_Angeles`

Example:

```bash
supabase secrets set \
  URL="https://<project-ref>.supabase.co" \
  SERVICE_ROLE_KEY="<service-role-key>" \
  COMMITTEE_CALENDAR_CRON_SECRET="<random-string>" \
  ASI_CALENDAR_TIME_ZONE="America/Los_Angeles"
```

### 3) Schedule it twice daily

Supabase schedules Edge Functions with `pg_cron` + `pg_net`. Store the project URL,
anon key, and cron secret in Vault, then schedule an HTTP call.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<your anon key>', 'anon_key');
select vault.create_secret('<your COMMITTEE_CALENDAR_CRON_SECRET>', 'committee_calendar_cron_secret');

-- Twice daily. This is 7am and 7pm Pacific during daylight saving time.
-- Cron runs in UTC, so adjust if you need exact local wall-clock time year-round.
select
  cron.schedule(
    'committee-calendar-sync-twice-daily',
    '0 14,2 * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
              || '/functions/v1/committee-calendar-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'committee_calendar_cron_secret')
        ),
        body := jsonb_build_object('source', 'pg_cron', 'ts', now()),
        timeout_milliseconds := 60000
      );
    $$
  );
```

Manual test with a one-off URL list:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/committee-calendar-sync" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <COMMITTEE_CALENDAR_CRON_SECRET>" \
  -d '{"urls":["https://www.asi.calpoly.edu/events/business-finance-meeting_s26/"],"lookaheadDays":60}'
```

---

## Supabase Edge Function: create-event-geocoded

The frontend event form now calls an Edge Function (`create-event-geocoded`) instead of FastAPI.

What it does:

- Accepts event payload (`title`, `datetime`, `address`, `description`, optional `imagePath` and `organizerId`)
- Geocodes the address via Nominatim
- Calls the `create_event` RPC in Postgres
- Returns the created event in frontend shape (`uuid`, `title`, `datetime`, `address`, `description`, `imagePath`, `organizerId`)

Deploy:

```bash
supabase functions deploy create-event-geocoded --no-verify-jwt
```

Required function secrets:

- `URL`
- `SERVICE_ROLE_KEY`

---

## Edge Function: summarize-municipal-sections

Generates a plain-English summary of selected municipal code sections using the Google Gemini API (called from the Ordinance Draft page).

Deploy (JWT verification enabled so only logged-in users can call it):

```bash
supabase functions deploy summarize-municipal-sections
```

Required secrets:

- `URL` — Supabase project URL
- `SERVICE_ROLE_KEY` — service role key (used to validate the user JWT)
- `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/) API key

Optional:

- `GEMINI_MODEL` — defaults to `gemini-2.0-flash` if unset

Example:

```bash
supabase secrets set GEMINI_API_KEY="your-key"
```
