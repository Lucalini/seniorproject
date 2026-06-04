-- SLO City government meeting calendar ingestion.
--
-- The committee-calendar-sync Edge Function also supports CivicPlus calendar
-- pages. This source imports published City Council and advisory body meeting
-- dates from the public SLO City government meetings calendar.

insert into public.calendar_event_sources
  (name, source_type, url, default_address, default_latitude, default_longitude)
values
  (
    'SLO City Government Meetings Calendar',
    'slo_city_government_calendar',
    'https://www.slocity.org/living/calendars/government-meetings',
    '990 Palm Street, San Luis Obispo, CA 93401',
    35.2828,
    -120.6596
  )
on conflict (url) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  default_address = excluded.default_address,
  default_latitude = excluded.default_latitude,
  default_longitude = excluded.default_longitude,
  active = true,
  updated_at = now();
