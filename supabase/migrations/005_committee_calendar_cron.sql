-- Scheduled sync for committee calendar events via pg_cron.
--
-- SCHEDULE: Every 6 hours at the top of the hour (0 */6 * * *).
-- This runs at 00:00, 06:00, 12:00, and 18:00 UTC daily.
--
-- WHY EVERY 6 HOURS:
--   - Meets the requirement of "no less than once per day, no more than once per hour"
--   - Balances data freshness with resource usage
--   - ASI committee meetings change infrequently (weekly/biweekly schedules)
--
-- TO ADJUST THE SCHEDULE:
--   Update the cron expression in the cron.job table:
--     SELECT cron.alter_job(
--       (SELECT jobid FROM cron.job WHERE jobname = 'committee-calendar-sync'),
--       schedule := '0 */4 * * *'  -- e.g., every 4 hours
--     );
--
--   Common schedules:
--     '0 */6 * * *'  = every 6 hours (default)
--     '0 */4 * * *'  = every 4 hours
--     '0 */12 * * *' = every 12 hours
--     '0 8 * * *'    = once daily at 8:00 UTC
--     '0 */1 * * *'  = every hour
--
-- DEPENDENCIES:
--   - pg_cron extension (scheduling)
--   - pg_net extension (async HTTP requests from within Postgres)
--   - The edge function at /functions/v1/committee-calendar-sync
--   - The COMMITTEE_CALENDAR_CRON_SECRET must be stored in vault or app.settings

-- Enable required extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema net;

-- Schedule the cron job to invoke the committee-calendar-sync edge function every 6 hours.
-- Uses net.http_post to make an async HTTP POST to the edge function.
-- The x-cron-secret header is sourced from the Supabase vault (decrypted_secrets view).
-- To set up the secret, run:
--   SELECT vault.create_secret('your-secret-value', 'committee_calendar_cron_secret');
select cron.schedule(
  'committee-calendar-sync',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := (select concat(decrypted_secret, '/functions/v1/committee-calendar-sync')
            from vault.decrypted_secrets
            where name = 'supabase_url'
            limit 1),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret
                        from vault.decrypted_secrets
                        where name = 'committee_calendar_cron_secret'
                        limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
