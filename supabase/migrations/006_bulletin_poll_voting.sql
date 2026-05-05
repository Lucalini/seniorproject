-- Bulletin Board poll voting aggregate counts and integrity guard.

create or replace view public.bulletin_poll_option_vote_counts as
select
  poll_option_id,
  count(*)::integer as votes
from public.bulletin_poll_response_options
group by poll_option_id;

create or replace function public.enforce_bulletin_poll_response_option_thread()
returns trigger
language plpgsql
as $$
declare
  v_response_thread uuid;
  v_option_thread uuid;
begin
  select thread_id into v_response_thread
  from public.bulletin_poll_responses
  where id = new.response_id;

  select thread_id into v_option_thread
  from public.bulletin_poll_options
  where id = new.poll_option_id;

  if v_response_thread is null or v_option_thread is null then
    raise exception 'Invalid poll response or poll option.';
  end if;

  if v_response_thread <> v_option_thread then
    raise exception 'Poll option must belong to the same thread as the poll response.';
  end if;

  if not exists (
    select 1
    from public.bulletin_threads t
    where t.id = v_response_thread
      and t.thread_type = 'poll'
      and t.status = 'active'
      and t.deleted_at is null
      and (t.poll_closes_at is null or t.poll_closes_at > now())
  ) then
    raise exception 'Poll is closed or unavailable.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bulletin_poll_response_option_thread on public.bulletin_poll_response_options;
create trigger trg_bulletin_poll_response_option_thread
  before insert on public.bulletin_poll_response_options
  for each row execute function public.enforce_bulletin_poll_response_option_thread();
