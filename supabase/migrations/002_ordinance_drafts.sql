-- One draft document per user; TipTap JSON in proposed_changes_json

create table ordinance_drafts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  subject                text not null default '',
  summary_text           text not null default '',
  reason_text            text not null default '',
  proposed_changes_json  jsonb not null default '{}'::jsonb,
  updated_at             timestamptz not null default now()
);

create index idx_ordinance_drafts_user on ordinance_drafts(user_id);

alter table ordinance_drafts enable row level security;

create policy "Users manage own ordinance drafts" on ordinance_drafts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Ensure inserts to user_code_selections get user_id from JWT when omitted
create or replace function public.set_user_code_selections_user_id()
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

drop trigger if exists trg_user_code_selections_user_id on user_code_selections;
create trigger trg_user_code_selections_user_id
  before insert on user_code_selections
  for each row execute function public.set_user_code_selections_user_id();
