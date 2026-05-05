-- Committee calendar ingestion support.
--
-- The app already reads from public.events. These additions make imported
-- committee meetings idempotent and updateable without changing the manual
-- event workflow.

create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists public.events (
  uuid uuid not null default gen_random_uuid(),
  organizer_id uuid null,
  image_path text not null default 'events/default.png',
  title text not null,
  description text not null default '',
  datetime timestamp with time zone not null,
  address text not null,
  geo geography(Point, 4326) not null,
  constraint events_pkey primary key (uuid)
);

create index if not exists events_geo_idx on public.events using gist (geo);

alter table public.events
  alter column image_path set default 'events/default.png',
  alter column description set default '';

alter table public.events
  add column if not exists end_datetime timestamp with time zone,
  add column if not exists source text not null default 'manual',
  add column if not exists source_url text,
  add column if not exists external_event_uid text,
  add column if not exists status text not null default 'scheduled',
  add column if not exists agenda_url text,
  add column if not exists agenda_title text,
  add column if not exists agenda_text text,
  add column if not exists external_updated_at timestamp with time zone,
  add column if not exists imported_at timestamp with time zone,
  add column if not exists last_seen_at timestamp with time zone,
  add column if not exists source_raw jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_status_check'
  ) then
    alter table public.events
      add constraint events_status_check
      check (status in ('scheduled', 'cancelled')) not valid;
  end if;
end $$;

create unique index if not exists events_source_external_event_uid_idx
  on public.events (source, external_event_uid)
  where external_event_uid is not null;

create index if not exists events_datetime_idx on public.events (datetime);
create index if not exists events_source_idx on public.events (source);
create index if not exists events_status_idx on public.events (status);

create table if not exists public.calendar_event_sources (
  uuid uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null default 'asi_wordpress_event',
  url text not null unique,
  active boolean not null default true,
  default_address text not null default '1 Grand Avenue, San Luis Obispo, CA 93407',
  default_latitude double precision not null default 35.301,
  default_longitude double precision not null default -120.659,
  last_checked_at timestamp with time zone,
  last_success_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists calendar_event_sources_active_idx
  on public.calendar_event_sources (active);

insert into public.calendar_event_sources
  (name, source_type, url, default_address, default_latitude, default_longitude)
values
  (
    'ASI Executive Cabinet',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/asi-executive-cabinet/?recurrence=20260508',
    '1 Grand Avenue, San Luis Obispo, CA 93407',
    35.301,
    -120.659
  ),
  (
    'ASI Board of Directors',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/asi-board-of-directors-workshop/?recurrence=20260511',
    '1 Grand Avenue, San Luis Obispo, CA 93407',
    35.301,
    -120.659
  ),
  (
    'University Union Advisory Board',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/university-union-advisory-board-uuab-meeting/?recurrence=20260505',
    '1 Grand Avenue, San Luis Obispo, CA 93407',
    35.301,
    -120.659
  ),
  (
    'ASI Business and Finance Committee',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/business-finance-meeting_s26/',
    '1 Grand Avenue, San Luis Obispo, CA 93407',
    35.301,
    -120.659
  ),
  (
    'ASI/UU Internal Review Committee',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/internal-review-committee-s26/',
    '1 Grand Avenue, San Luis Obispo, CA 93407',
    35.301,
    -120.659
  ),
  (
    'ASI External Affairs Committee',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/asi-external-affairs-committee/',
    '1 Grand Avenue, San Luis Obispo, CA 93407',
    35.301,
    -120.659
  ),
  (
    'ASI Recruitment and Elections Committee',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/asi-recruitment-elections-committee/',
    '1 Grand Avenue, San Luis Obispo, CA 93407',
    35.301,
    -120.659
  ),
  (
    'ASI DEI and Justice Committee',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/asi-diversity-equity-integrity-justice-committee/',
    '1 Grand Avenue, San Luis Obispo, CA 93407',
    35.301,
    -120.659
  ),
  (
    'Student Community Liaison Committee',
    'asi_wordpress_event',
    'https://www.asi.calpoly.edu/events/student-community-liaison-committee-7/?recurrence=20260515',
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_calendar_event_sources_updated_at on public.calendar_event_sources;
create trigger trg_calendar_event_sources_updated_at
  before update on public.calendar_event_sources
  for each row execute function public.set_updated_at();

-- Replacing create_event must DROP first: Postgres rejects CREATE OR REPLACE when the
-- RETURNS TABLE row type differs from the existing function (42P13).
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_event'
  loop
    execute format('drop function %s', fn);
  end loop;
end $$;

create or replace function public.create_event(
  p_title text,
  p_description text,
  p_datetime timestamp with time zone,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_image_path text default 'events/default.png',
  p_organizer_id uuid default null
)
returns table (
  uuid uuid,
  title text,
  description text,
  event_datetime timestamp with time zone,
  address text,
  image_path text,
  organizer_id uuid
)
language sql
security definer
set search_path = public, extensions
as $$
  insert into public.events (
    organizer_id,
    image_path,
    title,
    description,
    datetime,
    address,
    geo
  )
  values (
    p_organizer_id,
    coalesce(nullif(p_image_path, ''), 'events/default.png'),
    p_title,
    coalesce(p_description, ''),
    p_datetime,
    p_address,
    st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
  )
  returning
    events.uuid,
    events.title,
    events.description,
    events.datetime as event_datetime,
    events.address,
    events.image_path,
    events.organizer_id;
$$;

create or replace function public.upsert_imported_event(
  p_external_event_uid text,
  p_source text,
  p_source_url text,
  p_title text,
  p_description text,
  p_datetime timestamp with time zone,
  p_end_datetime timestamp with time zone,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_image_path text default 'events/default.png',
  p_status text default 'scheduled',
  p_agenda_url text default null,
  p_agenda_title text default null,
  p_agenda_text text default null,
  p_external_updated_at timestamp with time zone default null,
  p_source_raw jsonb default '{}'::jsonb
)
returns setof public.events
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_status text := coalesce(nullif(p_status, ''), 'scheduled');
begin
  if p_external_event_uid is null or btrim(p_external_event_uid) = '' then
    raise exception 'p_external_event_uid is required';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'p_latitude and p_longitude are required';
  end if;

  if v_status not in ('scheduled', 'cancelled') then
    raise exception 'Unsupported event status: %', v_status;
  end if;

  return query
  insert into public.events (
    external_event_uid,
    source,
    source_url,
    title,
    description,
    datetime,
    end_datetime,
    address,
    geo,
    image_path,
    status,
    agenda_url,
    agenda_title,
    agenda_text,
    external_updated_at,
    imported_at,
    last_seen_at,
    source_raw
  )
  values (
    p_external_event_uid,
    coalesce(nullif(p_source, ''), 'imported'),
    p_source_url,
    p_title,
    coalesce(p_description, ''),
    p_datetime,
    p_end_datetime,
    p_address,
    st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
    coalesce(nullif(p_image_path, ''), 'events/default.png'),
    v_status,
    nullif(p_agenda_url, ''),
    nullif(p_agenda_title, ''),
    nullif(p_agenda_text, ''),
    p_external_updated_at,
    now(),
    now(),
    coalesce(p_source_raw, '{}'::jsonb)
  )
  on conflict (source, external_event_uid)
  where external_event_uid is not null
  do update set
    source_url = excluded.source_url,
    title = excluded.title,
    description = excluded.description,
    datetime = excluded.datetime,
    end_datetime = excluded.end_datetime,
    address = excluded.address,
    geo = excluded.geo,
    image_path = excluded.image_path,
    status = excluded.status,
    agenda_url = excluded.agenda_url,
    agenda_title = excluded.agenda_title,
    agenda_text = excluded.agenda_text,
    external_updated_at = excluded.external_updated_at,
    last_seen_at = now(),
    source_raw = excluded.source_raw
  returning *;
end;
$$;
