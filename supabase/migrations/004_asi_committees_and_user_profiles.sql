-- ASI committee directory + user personalization.

create table if not exists public.asi_committees (
  key text primary key,
  name text not null,
  short_name text,
  description text not null,
  committee_url text not null,
  event_source_url text not null,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists asi_committees_active_order_idx
  on public.asi_committees (active, display_order);

insert into public.asi_committees
  (key, name, short_name, description, committee_url, event_source_url, display_order)
values
  (
    'asi-executive-cabinet',
    'ASI Executive Cabinet',
    'Executive Cabinet',
    'The ASI president and chief of staff oversee the Executive Cabinet, which works with student volunteers, ASI staff, and community members to carry out the president''s goals. Elected in the annual spring ASI elections, the ASI president works with university, city, and state leaders to represent student interests at every level.',
    'https://www.asi.calpoly.edu/get-involved/student-government/executive-cabinet/',
    'https://www.asi.calpoly.edu/events/asi-executive-cabinet/?recurrence=20260508',
    10
  ),
  (
    'asi-board-of-directors',
    'ASI Board of Directors',
    'Board of Directors',
    'The official voice of Cal Poly students. Student-elected representatives from each academic college serve on the Board of Directors. Their responsibilities range from oversight of ASI corporate activity to representing and advocating on behalf of students.',
    'https://www.asi.calpoly.edu/get-involved/student-government/board-of-directors/',
    'https://www.asi.calpoly.edu/events/asi-board-of-directors-workshop/?recurrence=20260511',
    20
  ),
  (
    'university-union-advisory-board',
    'University Union Advisory Board',
    'UUAB',
    'The University Union Advisory Board makes policy recommendations for ASI-managed facilities, including the Cal Poly Recreation Center, Julian A. McPhee University Union, Cal Poly Sports Complex, Doerr Family Field, and The Forum, while working to maintain the integrity of the University Union student body fee.',
    'https://www.asi.calpoly.edu/get-involved/student-government/uuab/',
    'https://www.asi.calpoly.edu/events/university-union-advisory-board-uuab-meeting/?recurrence=20260505',
    30
  ),
  (
    'asi-business-finance',
    'ASI Business & Finance Committee',
    'Business & Finance',
    'Responsible for issues relating to all corporate finance and personnel matters. The specific operations of this committee in regard to personnel matters are carried out in accordance with the ASI Personnel Policy Manual. This committee reviews the ASI budget, recommends personnel and human resources changes to the Board of Directors, and provides fiscal insight to the club funding liaisons regarding ASI Club Funding.',
    'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-business-finance/',
    'https://www.asi.calpoly.edu/events/business-finance-meeting_s26/',
    40
  ),
  (
    'asi-uu-internal-review',
    'ASI/UU Internal Review Committee',
    'Internal Review',
    'Responsible for reviewing and making recommendations to the board on ASI Club Funding Policies, independent auditor service proposals and audit firm selection, ASI Audit, Corporate Risk Management and Insurance Plans, ASI Bylaws, and policy additions or modifications.',
    'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-uu-internal-review-committee/',
    'https://www.asi.calpoly.edu/events/internal-review-committee-s26/',
    50
  ),
  (
    'asi-external-affairs',
    'ASI External Affairs Committee',
    'External Affairs',
    'Responsible for representing, serving, and addressing student concerns before local, state, and federal legislature. The committee recommends whether to support or oppose pending legislation concerning Cal Poly students or the California State University system, communicates lobbying efforts, researches legislation, reports issues to the board, and builds long-term relationships between ASI and city, county, and state representatives.',
    'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-external-affairs/',
    'https://www.asi.calpoly.edu/events/asi-external-affairs-committee/',
    60
  ),
  (
    'asi-recruitment-elections',
    'ASI Recruitment & Elections Committee',
    'Recruitment & Elections',
    'This committee is responsible for the effective recruitment of candidates to serve in every branch of Student Government in addition to ASI Leadership Team positions. The committee develops and recommends election regulations for board approval, supervises all ASI elections, and reports election results to the board in accordance with the ASI Election Code.',
    'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-recruitment-elections-committee/',
    'https://www.asi.calpoly.edu/events/asi-recruitment-elections-committee/',
    70
  ),
  (
    'asi-deij',
    'ASI Diversity, Equity, Inclusion, & Justice Committee',
    'DEIJ',
    'Responsible for ensuring Student Government serves as an inclusive environment that addresses the needs and concerns of underrepresented minority students. The committee may recommend inclusive language and consideration of student intersectionality within endorsements, resolutions, and bills, hosts town halls for student feedback, and applies diversity, equity, inclusion, and allyship training across Student Government work.',
    'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-diversity-inclusion/',
    'https://www.asi.calpoly.edu/events/asi-diversity-equity-integrity-justice-committee/',
    80
  ),
  (
    'student-community-liaison',
    'Student Community Liaison Committee',
    'SCLC',
    'The Student Community Liaison Committee serves as a mechanism of communication among Cal Poly, Cuesta College, the City and County of San Luis Obispo, and community organizations. Its mission is to proactively engage in discussions that promote positive relations, mutual respect, and improved quality of life for all citizens of San Luis Obispo.',
    'https://www.asi.calpoly.edu/get-involved/student-government/student-community-liaison-committee/',
    'https://www.asi.calpoly.edu/events/student-community-liaison-committee-7/?recurrence=20260515',
    90
  )
on conflict (key) do update
set
  name = excluded.name,
  short_name = excluded.short_name,
  description = excluded.description,
  committee_url = excluded.committee_url,
  event_source_url = excluded.event_source_url,
  active = excluded.active,
  display_order = excluded.display_order,
  updated_at = now();

alter table public.calendar_event_sources
  add column if not exists committee_key text;

alter table public.events
  add column if not exists committee_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.calendar_event_sources'::regclass
      and conname = 'calendar_event_sources_committee_key_fkey'
  ) then
    alter table public.calendar_event_sources
      add constraint calendar_event_sources_committee_key_fkey
      foreign key (committee_key) references public.asi_committees(key)
      on delete set null not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_committee_key_fkey'
  ) then
    alter table public.events
      add constraint events_committee_key_fkey
      foreign key (committee_key) references public.asi_committees(key)
      on delete set null not valid;
  end if;
end $$;

create index if not exists calendar_event_sources_committee_key_idx
  on public.calendar_event_sources (committee_key);

create index if not exists events_committee_key_idx
  on public.events (committee_key);

create index if not exists events_organizer_id_idx
  on public.events (organizer_id);

update public.calendar_event_sources
set committee_key = v.committee_key,
    updated_at = now()
from (
  values
    ('https://www.asi.calpoly.edu/events/asi-executive-cabinet/?recurrence=20260508', 'asi-executive-cabinet'),
    ('https://www.asi.calpoly.edu/events/asi-board-of-directors-workshop/?recurrence=20260511', 'asi-board-of-directors'),
    ('https://www.asi.calpoly.edu/events/university-union-advisory-board-uuab-meeting/?recurrence=20260505', 'university-union-advisory-board'),
    ('https://www.asi.calpoly.edu/events/business-finance-meeting_s26/', 'asi-business-finance'),
    ('https://www.asi.calpoly.edu/events/internal-review-committee-s26/', 'asi-uu-internal-review'),
    ('https://www.asi.calpoly.edu/events/asi-external-affairs-committee/', 'asi-external-affairs'),
    ('https://www.asi.calpoly.edu/events/asi-recruitment-elections-committee/', 'asi-recruitment-elections'),
    ('https://www.asi.calpoly.edu/events/asi-diversity-equity-integrity-justice-committee/', 'asi-deij'),
    ('https://www.asi.calpoly.edu/events/student-community-liaison-committee-7/?recurrence=20260515', 'student-community-liaison')
) as v(url, committee_key)
where public.calendar_event_sources.url = v.url;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_asi_member boolean not null default false,
  asi_member_role text,
  asi_committee_memberships text[] not null default '{}'::text[],
  asi_member_verified_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists profiles_is_asi_member_idx
  on public.profiles (is_asi_member);

create table if not exists public.user_committee_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  committee_key text not null references public.asi_committees(key) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (user_id, committee_key)
);

create index if not exists user_committee_follows_user_idx
  on public.user_committee_follows (user_id);

create index if not exists user_committee_follows_committee_idx
  on public.user_committee_follows (committee_key);

alter table public.asi_committees enable row level security;
alter table public.profiles enable row level security;
alter table public.user_committee_follows enable row level security;

drop policy if exists "Public read access" on public.asi_committees;
create policy "Public read access" on public.asi_committees
  for select using (true);

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own committee follows" on public.user_committee_follows;
create policy "Users manage own committee follows" on public.user_committee_follows
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

create or replace function public.set_user_committee_follow_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_committee_follows_user_id on public.user_committee_follows;
create trigger trg_user_committee_follows_user_id
  before insert on public.user_committee_follows
  for each row execute function public.set_user_committee_follow_user_id();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

insert into public.profiles (user_id, display_name)
select id, email
from auth.users
on conflict (user_id) do nothing;

drop function if exists public.upsert_imported_event(
  text,
  text,
  text,
  text,
  text,
  timestamp with time zone,
  timestamp with time zone,
  text,
  double precision,
  double precision,
  text,
  text,
  text,
  text,
  text,
  timestamp with time zone,
  jsonb
);

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
  p_source_raw jsonb default '{}'::jsonb,
  p_committee_key text default null
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
    committee_key,
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
    nullif(p_committee_key, ''),
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
    committee_key = excluded.committee_key,
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
