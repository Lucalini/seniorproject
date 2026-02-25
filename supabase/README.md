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

