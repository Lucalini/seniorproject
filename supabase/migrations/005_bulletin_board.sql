-- Bulletin Board persistence.

create extension if not exists pgcrypto;

create table if not exists public.bulletin_board_tags (
  key text primary key,
  label text not null,
  tag_kind text not null default 'committee',
  committee_key text references public.asi_committees(key) on delete cascade,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint bulletin_board_tags_kind_check check (tag_kind in ('system', 'committee')),
  constraint bulletin_board_tags_committee_unique unique (committee_key)
);

insert into public.bulletin_board_tags (key, label, tag_kind, display_order)
values ('suggestions', 'Suggestions', 'system', 0)
on conflict (key) do update
set label = excluded.label,
    tag_kind = excluded.tag_kind,
    active = true,
    display_order = excluded.display_order,
    updated_at = now();

insert into public.bulletin_board_tags (key, label, tag_kind, committee_key, display_order)
select
  key,
  coalesce(nullif(short_name, ''), name),
  'committee',
  key,
  display_order
from public.asi_committees
where active = true
on conflict (key) do update
set label = excluded.label,
    tag_kind = excluded.tag_kind,
    committee_key = excluded.committee_key,
    active = true,
    display_order = excluded.display_order,
    updated_at = now();

create table if not exists public.bulletin_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_display_name text not null default 'Cal Poly user',
  title text not null,
  body text not null,
  thread_type text not null default 'normal',
  status text not null default 'active',
  poll_closes_at timestamp with time zone,
  event_location text,
  event_starts_at timestamp with time zone,
  event_ends_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone,
  constraint bulletin_threads_type_check check (thread_type in ('normal', 'poll', 'event')),
  constraint bulletin_threads_status_check check (status in ('active', 'hidden', 'archived')),
  constraint bulletin_threads_title_not_blank check (length(btrim(title)) > 0),
  constraint bulletin_threads_body_not_blank check (length(btrim(body)) > 0),
  constraint bulletin_threads_event_order_check check (
    event_ends_at is null or event_starts_at is null or event_ends_at >= event_starts_at
  )
);

create index if not exists bulletin_threads_created_at_idx on public.bulletin_threads (created_at desc);
create index if not exists bulletin_threads_type_idx on public.bulletin_threads (thread_type);
create index if not exists bulletin_threads_status_idx on public.bulletin_threads (status);
create index if not exists bulletin_threads_author_idx on public.bulletin_threads (author_id);

create table if not exists public.bulletin_thread_tags (
  thread_id uuid not null references public.bulletin_threads(id) on delete cascade,
  tag_key text not null references public.bulletin_board_tags(key) on delete restrict,
  created_at timestamp with time zone not null default now(),
  primary key (thread_id, tag_key)
);

create index if not exists bulletin_thread_tags_tag_idx on public.bulletin_thread_tags (tag_key);

create table if not exists public.bulletin_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.bulletin_threads(id) on delete cascade,
  parent_id uuid references public.bulletin_comments(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_display_name text not null default 'Cal Poly user',
  body text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone,
  constraint bulletin_comments_body_not_blank check (length(btrim(body)) > 0)
);

create index if not exists bulletin_comments_thread_idx on public.bulletin_comments (thread_id, created_at);
create index if not exists bulletin_comments_parent_idx on public.bulletin_comments (parent_id);
create index if not exists bulletin_comments_author_idx on public.bulletin_comments (author_id);

create table if not exists public.bulletin_thread_votes (
  thread_id uuid not null references public.bulletin_threads(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  value smallint not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (thread_id, user_id),
  constraint bulletin_thread_votes_value_check check (value in (-1, 1))
);

create index if not exists bulletin_thread_votes_user_idx on public.bulletin_thread_votes (user_id);

create table if not exists public.bulletin_comment_votes (
  comment_id uuid not null references public.bulletin_comments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  value smallint not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (comment_id, user_id),
  constraint bulletin_comment_votes_value_check check (value in (-1, 1))
);

create index if not exists bulletin_comment_votes_user_idx on public.bulletin_comment_votes (user_id);

create table if not exists public.bulletin_poll_options (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.bulletin_threads(id) on delete cascade,
  body text not null,
  position integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint bulletin_poll_options_body_not_blank check (length(btrim(body)) > 0),
  unique (thread_id, position)
);

create index if not exists bulletin_poll_options_thread_idx on public.bulletin_poll_options (thread_id, position);

create table if not exists public.bulletin_poll_responses (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.bulletin_threads(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (thread_id, user_id)
);

create table if not exists public.bulletin_poll_response_options (
  response_id uuid not null references public.bulletin_poll_responses(id) on delete cascade,
  poll_option_id uuid not null references public.bulletin_poll_options(id) on delete cascade,
  primary key (response_id, poll_option_id)
);

create table if not exists public.bulletin_board_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  hidden_tag_keys text[] not null default '{}'::text[],
  hidden_thread_types text[] not null default '{}'::text[],
  sort_order text not null default 'newest',
  updated_at timestamp with time zone not null default now(),
  constraint bulletin_board_preferences_sort_check check (
    sort_order in ('newest', 'oldest', 'most-upvoted', 'most-commented')
  )
);

create or replace view public.bulletin_thread_vote_counts as
select
  thread_id,
  count(*) filter (where value = 1)::integer as likes,
  count(*) filter (where value = -1)::integer as dislikes
from public.bulletin_thread_votes
group by thread_id;

create or replace view public.bulletin_comment_vote_counts as
select
  comment_id,
  count(*) filter (where value = 1)::integer as likes,
  count(*) filter (where value = -1)::integer as dislikes
from public.bulletin_comment_votes
group by comment_id;

create or replace function public.set_bulletin_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_bulletin_thread_edit_metadata()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if old.title is distinct from new.title or old.body is distinct from new.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.set_bulletin_comment_edit_metadata()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if old.body is distinct from new.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.set_bulletin_author_display_name()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_display_name text;
begin
  if new.author_id is null then
    new.author_id := auth.uid();
  end if;

  if new.author_id is null then
    raise exception 'author_id is required';
  end if;

  select coalesce(nullif(p.display_name, ''), u.email, 'Cal Poly user')
    into v_display_name
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = new.author_id;

  new.author_display_name := coalesce(v_display_name, 'Cal Poly user');
  return new;
end;
$$;

create or replace function public.enforce_bulletin_thread_tag_limit()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.bulletin_thread_tags
  where thread_id = new.thread_id;

  if v_count >= 2 then
    raise exception 'A bulletin thread can have at most 2 tags.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bulletin_threads_author on public.bulletin_threads;
create trigger trg_bulletin_threads_author
  before insert on public.bulletin_threads
  for each row execute function public.set_bulletin_author_display_name();

drop trigger if exists trg_bulletin_comments_author on public.bulletin_comments;
create trigger trg_bulletin_comments_author
  before insert on public.bulletin_comments
  for each row execute function public.set_bulletin_author_display_name();

drop trigger if exists trg_bulletin_threads_updated_at on public.bulletin_threads;
create trigger trg_bulletin_threads_updated_at
  before update on public.bulletin_threads
  for each row execute function public.set_bulletin_thread_edit_metadata();

drop trigger if exists trg_bulletin_comments_updated_at on public.bulletin_comments;
create trigger trg_bulletin_comments_updated_at
  before update on public.bulletin_comments
  for each row execute function public.set_bulletin_comment_edit_metadata();

drop trigger if exists trg_bulletin_tags_updated_at on public.bulletin_board_tags;
create trigger trg_bulletin_tags_updated_at
  before update on public.bulletin_board_tags
  for each row execute function public.set_bulletin_updated_at();

drop trigger if exists trg_bulletin_thread_votes_updated_at on public.bulletin_thread_votes;
create trigger trg_bulletin_thread_votes_updated_at
  before update on public.bulletin_thread_votes
  for each row execute function public.set_bulletin_updated_at();

drop trigger if exists trg_bulletin_comment_votes_updated_at on public.bulletin_comment_votes;
create trigger trg_bulletin_comment_votes_updated_at
  before update on public.bulletin_comment_votes
  for each row execute function public.set_bulletin_updated_at();

drop trigger if exists trg_bulletin_preferences_updated_at on public.bulletin_board_preferences;
create trigger trg_bulletin_preferences_updated_at
  before update on public.bulletin_board_preferences
  for each row execute function public.set_bulletin_updated_at();

drop trigger if exists trg_bulletin_thread_tags_limit on public.bulletin_thread_tags;
create trigger trg_bulletin_thread_tags_limit
  before insert on public.bulletin_thread_tags
  for each row execute function public.enforce_bulletin_thread_tag_limit();

alter table public.bulletin_board_tags enable row level security;
alter table public.bulletin_threads enable row level security;
alter table public.bulletin_thread_tags enable row level security;
alter table public.bulletin_comments enable row level security;
alter table public.bulletin_thread_votes enable row level security;
alter table public.bulletin_comment_votes enable row level security;
alter table public.bulletin_poll_options enable row level security;
alter table public.bulletin_poll_responses enable row level security;
alter table public.bulletin_poll_response_options enable row level security;
alter table public.bulletin_board_preferences enable row level security;

drop policy if exists "Public read bulletin tags" on public.bulletin_board_tags;
create policy "Public read bulletin tags" on public.bulletin_board_tags
  for select using (active = true);

drop policy if exists "Public read visible bulletin threads" on public.bulletin_threads;
create policy "Public read visible bulletin threads" on public.bulletin_threads
  for select using (status in ('active', 'archived') and deleted_at is null);

drop policy if exists "Authenticated users create bulletin threads" on public.bulletin_threads;
create policy "Authenticated users create bulletin threads" on public.bulletin_threads
  for insert with check (auth.uid() = author_id and status = 'active');

drop policy if exists "Authors update own bulletin threads" on public.bulletin_threads;
create policy "Authors update own bulletin threads" on public.bulletin_threads
  for update using (auth.uid() = author_id and status <> 'archived')
  with check (auth.uid() = author_id);

drop policy if exists "Public read visible bulletin thread tags" on public.bulletin_thread_tags;
create policy "Public read visible bulletin thread tags" on public.bulletin_thread_tags
  for select using (
    exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.status in ('active', 'archived')
        and t.deleted_at is null
    )
  );

drop policy if exists "Authors manage own bulletin thread tags" on public.bulletin_thread_tags;
create policy "Authors manage own bulletin thread tags" on public.bulletin_thread_tags
  for all using (
    exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.author_id = auth.uid()
        and t.status <> 'archived'
    )
  )
  with check (
    exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.author_id = auth.uid()
        and t.status <> 'archived'
    )
  );

drop policy if exists "Public read visible bulletin comments" on public.bulletin_comments;
create policy "Public read visible bulletin comments" on public.bulletin_comments
  for select using (
    exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.status in ('active', 'archived')
        and t.deleted_at is null
    )
  );

drop policy if exists "Authenticated users create bulletin comments" on public.bulletin_comments;
create policy "Authenticated users create bulletin comments" on public.bulletin_comments
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.status = 'active'
        and t.deleted_at is null
    )
  );

drop policy if exists "Authors update own bulletin comments" on public.bulletin_comments;
create policy "Authors update own bulletin comments" on public.bulletin_comments
  for update using (
    auth.uid() = author_id
    and exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.status = 'active'
        and t.deleted_at is null
    )
  )
  with check (auth.uid() = author_id);

drop policy if exists "Users read own thread votes" on public.bulletin_thread_votes;
create policy "Users read own thread votes" on public.bulletin_thread_votes
  for select using (auth.uid() = user_id);

drop policy if exists "Users manage own thread votes" on public.bulletin_thread_votes;
create policy "Users manage own thread votes" on public.bulletin_thread_votes
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.status = 'active'
        and t.deleted_at is null
    )
  );

drop policy if exists "Users read own comment votes" on public.bulletin_comment_votes;
create policy "Users read own comment votes" on public.bulletin_comment_votes
  for select using (auth.uid() = user_id);

drop policy if exists "Users manage own comment votes" on public.bulletin_comment_votes;
create policy "Users manage own comment votes" on public.bulletin_comment_votes
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.bulletin_comments c
      join public.bulletin_threads t on t.id = c.thread_id
      where c.id = comment_id
        and t.status = 'active'
        and t.deleted_at is null
    )
  );

drop policy if exists "Public read bulletin poll options" on public.bulletin_poll_options;
create policy "Public read bulletin poll options" on public.bulletin_poll_options
  for select using (
    exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.thread_type = 'poll'
        and t.status in ('active', 'archived')
        and t.deleted_at is null
    )
  );

drop policy if exists "Authors manage own bulletin poll options" on public.bulletin_poll_options;
create policy "Authors manage own bulletin poll options" on public.bulletin_poll_options
  for all using (
    exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.author_id = auth.uid()
        and t.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.author_id = auth.uid()
        and t.status = 'active'
    )
  );

drop policy if exists "Users read own poll responses" on public.bulletin_poll_responses;
create policy "Users read own poll responses" on public.bulletin_poll_responses
  for select using (auth.uid() = user_id);

drop policy if exists "Users create own poll responses" on public.bulletin_poll_responses;
create policy "Users create own poll responses" on public.bulletin_poll_responses
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.bulletin_threads t
      where t.id = thread_id
        and t.thread_type = 'poll'
        and t.status = 'active'
        and t.deleted_at is null
        and (t.poll_closes_at is null or t.poll_closes_at > now())
    )
  );

drop policy if exists "Users read own poll response options" on public.bulletin_poll_response_options;
create policy "Users read own poll response options" on public.bulletin_poll_response_options
  for select using (
    exists (
      select 1 from public.bulletin_poll_responses r
      where r.id = response_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Users create own poll response options" on public.bulletin_poll_response_options;
create policy "Users create own poll response options" on public.bulletin_poll_response_options
  for insert with check (
    exists (
      select 1 from public.bulletin_poll_responses r
      where r.id = response_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own bulletin preferences" on public.bulletin_board_preferences;
create policy "Users manage own bulletin preferences" on public.bulletin_board_preferences
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
