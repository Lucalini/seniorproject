-- Municipal code hierarchical storage + user edits/selections

create table municipal_code_nodes (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references municipal_code_nodes(id) on delete cascade,
  node_type   text not null check (node_type in ('title', 'chapter', 'section')),
  number      text not null unique,
  heading     text not null,
  body        text,
  sort_order  int not null default 0
);

create index idx_mcn_parent on municipal_code_nodes(parent_id);
create index idx_mcn_type   on municipal_code_nodes(node_type);

alter table municipal_code_nodes enable row level security;

create policy "Public read access" on municipal_code_nodes
  for select using (true);

create table user_code_selections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  node_id     uuid not null references municipal_code_nodes(id) on delete cascade,
  edited_body text,
  selected    boolean not null default true,
  updated_at  timestamptz not null default now(),
  unique (user_id, node_id)
);

create index idx_ucs_user on user_code_selections(user_id);

alter table user_code_selections enable row level security;

create policy "Users manage own selections" on user_code_selections
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
