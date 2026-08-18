-- ============================================================
-- Wizardocs — Supabase schema
-- Paste this entire file into the Supabase SQL editor and run.
-- ============================================================

-- 1. users_profile
--    Extends Supabase auth.users with app-specific fields.
--    Auto-created on first sign-in via the trigger below.
create table if not exists public.users_profile (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  plan        text not null default 'free',   -- 'free' | 'pro' | 'team'
  created_at  timestamptz not null default now()
);

-- 2. workspaces
--    One workspace auto-created per user on signup (user = workspace for now).
--
--    owner_id is unique, because "one per user" is not a convention here — it is
--    what every lookup in the system already assumes. db.py resolves a user to a
--    workspace with `order by created_at asc limit 1` in three places, and
--    begin_ask() below does the same in SQL. A second row for the same owner is
--    therefore unreachable: chats created in it resolve to the *older* workspace
--    on every ownership check, so /ask and /chats/{id}/messages answer 404 for a
--    chat that get_chats() still lists (it joins on owner_id, spanning both).
--
--    get_or_create_workspace() could create that second row from one failed GET:
--    a 500 from PostgREST reads as "this user has no workspace" and it inserts.
--    Two tabs racing on a genuinely new user did the same. This constraint is
--    what makes both of those a rejected insert instead of stranded data.
--
--    When Team workspaces arrive, drop this — and note that the three `limit 1`
--    lookups have to change with it either way.
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.users_profile (id) on delete cascade,
  name        text not null default 'My workspace',
  created_at  timestamptz not null default now()
);

-- The line above only covers a fresh database: `create table if not exists` is a
-- no-op on one that already has the table, so an existing project needs the
-- constraint added. Idempotent, like the rest of this file — safe to re-run.
--
-- This FAILS, loudly, if duplicate workspaces already exist. That is the point:
-- they are the bug, and which one to keep is a decision, not a default. Find
-- them with the query below; the keeper is the OLDEST, because that is the one
-- every existing lookup already resolves to.
--
--   select owner_id, count(*), array_agg(id order by created_at)
--     from public.workspaces group by owner_id having count(*) > 1;
--
-- Re-point the strays' chats at the keeper, then delete the strays. Re-pointing
-- first is what makes the chats reachable again instead of cascade-deleted:
--
--   with keep as (
--     select distinct on (owner_id) owner_id, id
--       from public.workspaces order by owner_id, created_at asc)
--   update public.chats c set workspace_id = k.id
--     from public.workspaces w join keep k on k.owner_id = w.owner_id
--    where c.workspace_id = w.id and w.id <> k.id;
--
--   delete from public.workspaces w where w.id not in (
--     select distinct on (owner_id) id
--       from public.workspaces order by owner_id, created_at asc);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_owner_id_key') then
    alter table public.workspaces add constraint workspaces_owner_id_key unique (owner_id);
  end if;
end $$;

-- 3. chats
create table if not exists public.chats (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  title         text not null default 'New conversation',
  created_at    timestamptz not null default now()
);

-- 4. messages
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  chat_id       uuid not null references public.chats (id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  sources_json  jsonb,          -- [{"number":1,"title":"...","url":"..."}]
  created_at    timestamptz not null default now()
);

-- 5. query_usage  (for 100 queries/month free tier)
create table if not exists public.query_usage (
  user_id       uuid not null references public.users_profile (id) on delete cascade,
  period_start  date not null default date_trunc('month', now())::date,
  count         int  not null default 0,
  primary key (user_id, period_start)
);

-- 6. chunk_usage  (for 5,000 indexed chunks free tier — used in Phase 5)
create table if not exists public.chunk_usage (
  workspace_id    uuid primary key references public.workspaces (id) on delete cascade,
  chunks_indexed  int not null default 0
);

-- 7. bookmarks (Pro feature 1)
--    Saved answers live on the message itself rather than in a join table:
--    a bookmark has no meaning without its message, and there is exactly one
--    per message. The partial index only covers bookmarked rows, which is the
--    tiny minority — the profile tab reads them, nothing else does.
alter table public.messages add column if not exists bookmarked    bool not null default false;
alter table public.messages add column if not exists bookmark_note text;

create index if not exists messages_bookmarked_idx
  on public.messages (chat_id) where bookmarked;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users_profile  enable row level security;
alter table public.workspaces      enable row level security;
alter table public.chats           enable row level security;
alter table public.messages        enable row level security;
alter table public.query_usage     enable row level security;
alter table public.chunk_usage     enable row level security;

-- users_profile: own row only
create policy "users_profile_own" on public.users_profile
  for all using (auth.uid() = id);

-- workspaces: own workspaces only
create policy "workspaces_own" on public.workspaces
  for all using (auth.uid() = owner_id);

-- chats: own chats (via workspace ownership)
create policy "chats_own" on public.chats
  for all using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

-- messages: own messages (via chat -> workspace ownership)
create policy "messages_own" on public.messages
  for all using (
    chat_id in (
      select c.id from public.chats c
      join public.workspaces w on w.id = c.workspace_id
      where w.owner_id = auth.uid()
    )
  );

-- query_usage: own row only
create policy "query_usage_own" on public.query_usage
  for select using (auth.uid() = user_id);

-- chunk_usage: own workspace only
create policy "chunk_usage_own" on public.chunk_usage
  for select using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: auto-create profile + workspace on first sign-in
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  -- create profile
  insert into public.users_profile (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );

  -- create default workspace
  insert into public.workspaces (owner_id, name)
  values (new.id, 'My workspace')
  returning id into new_workspace_id;

  -- seed chunk_usage for the workspace
  insert into public.chunk_usage (workspace_id) values (new_workspace_id);

  return new;
end;
$$;

-- attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- consume_query — atomic monthly quota counter  [NO LONGER CALLED]
-- ============================================================
-- Superseded by begin_ask() below, which does this increment as part of one
-- round trip. api/db.py called this only from a fallback path that no longer
-- exists. Left in place because removing it means a migration against the live
-- database, not an edit here — drop it with:
--     drop function if exists public.consume_query(uuid);
-- Nothing in the application will notice.
--
-- api/db.py used to read the count, compare it to the limit, then write it
-- back. Requests fired in parallel all read the same value before any write
-- landed, so the 100/month cap could be walked past. The insert below does
-- both halves in one statement; the row lock serialises concurrent callers.
create or replace function public.consume_query(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.query_usage (user_id, period_start, count)
  values (p_user_id, date_trunc('month', now())::date, 1)
  on conflict (user_id, period_start)
  do update set count = query_usage.count + 1
  returning count into new_count;

  return new_count;
end;
$$;

-- Called with the service-role key only; no direct client access.
-- PUBLIC must be named explicitly: Postgres grants EXECUTE to PUBLIC by default,
-- and anon/authenticated inherit it, so revoking from those two alone is a no-op.
-- The function is SECURITY DEFINER and takes p_user_id as an argument, so a
-- caller holding the anon key could otherwise burn any user's monthly quota.
revoke execute on function public.consume_query(uuid) from public, anon, authenticated;
grant  execute on function public.consume_query(uuid) to service_role;

-- ============================================================
-- refund_query — give a spent query back
-- ============================================================
-- consume_query() charges before the pipeline runs, so an OpenAI outage or a
-- refused over-limit request would otherwise cost the user one of their 100.
-- greatest(count - 1, 0) is the important part: without the floor a burst of
-- failures drives the counter negative and silently hands out free queries,
-- which is the mirror image of the race consume_query() exists to prevent.
create or replace function public.refund_query(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  update public.query_usage
     set count = greatest(count - 1, 0)
   where user_id = p_user_id
     and period_start = date_trunc('month', now())::date
  returning count into new_count;

  return new_count;
end;
$$;

-- Same reasoning as consume_query above: PUBLIC holds EXECUTE by default and
-- anon/authenticated inherit it, so revoking from those two alone is a no-op.
-- A caller with the anon key could otherwise refund their own quota forever.
revoke execute on function public.refund_query(uuid) from public, anon, authenticated;
grant  execute on function public.refund_query(uuid) to service_role;


-- ============================================================
-- begin_ask — the whole /ask preamble in one round trip
-- ============================================================
-- /ask used to make four sequential REST calls before any work started:
-- workspace lookup, chat lookup (ownership), plan read, then consume_query.
-- Each is a separate TLS request. This does all four in one, preserving the
-- ordering that matters: ownership is decided BEFORE the counter moves, so a
-- request that is about to be refused never consumes the allowance.
--
-- The free-tier limit deliberately stays in Python (FREE_QUERY_LIMIT) rather
-- than being duplicated here — this returns the count and lets the caller judge.
create or replace function public.begin_ask(p_user_id uuid, p_chat_id uuid default null)
returns table (owns_chat bool, plan text, queries_used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_owns      bool;
  v_plan      text;
  v_count     int;
begin
  select w.id into v_workspace
    from public.workspaces w
   where w.owner_id = p_user_id
   order by w.created_at asc
   limit 1;

  if p_chat_id is null then
    v_owns := true;
  else
    select exists (
      select 1 from public.chats c
       where c.id = p_chat_id and c.workspace_id = v_workspace
    ) into v_owns;
  end if;

  select up.plan into v_plan from public.users_profile up where up.id = p_user_id;
  v_plan := coalesce(v_plan, 'free');

  if not v_owns then
    select qu.count into v_count
      from public.query_usage qu
     where qu.user_id = p_user_id
       and qu.period_start = date_trunc('month', now())::date;
    return query select v_owns, v_plan, coalesce(v_count, 0);
    return;
  end if;

  insert into public.query_usage (user_id, period_start, count)
  values (p_user_id, date_trunc('month', now())::date, 1)
  on conflict (user_id, period_start)
  do update set count = query_usage.count + 1
  returning count into v_count;

  return query select v_owns, v_plan, v_count;
end;
$$;

-- SECURITY DEFINER taking p_user_id as an argument: anyone able to call this
-- could burn any user's quota and probe chat ownership. Same PUBLIC caveat as
-- consume_query — anon inherits EXECUTE from PUBLIC.
revoke execute on function public.begin_ask(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.begin_ask(uuid, uuid) to service_role;

-- ============================================================
-- create_chat — insert first, then prune, in one transaction
-- ============================================================
-- api/db.py used to delete the messages falling out of the 2-chat window and
-- any chat past the 10-chat cap, and only THEN insert the new chat: a failed
-- insert destroyed history and produced nothing. It was also four
-- unsynchronised REST calls, so two browser tabs could both pass the cap check.
-- Here the insert happens first and the whole thing is one statement block, so
-- the row locks serialise concurrent callers.
create or replace function public.create_chat(p_workspace_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  insert into public.chats (workspace_id, title)
  values (p_workspace_id, left(coalesce(p_title, 'New conversation'), 80))
  returning id into v_new_id;

  -- Messages are kept only for the 2 most recent chats. Bookmarked answers
  -- survive: a saved answer that evaporates is not saved. Sweeping every chat
  -- past position 2 rather than just the one that moved makes this self-healing
  -- if a previous prune was ever interrupted.
  delete from public.messages m
   using (
     select c.id
       from public.chats c
      where c.workspace_id = p_workspace_id
      order by c.created_at desc
      offset 2
   ) stale
   where m.chat_id = stale.id
     and not m.bookmarked;

  -- 10-chat cap. A chat holding a bookmark is kept, which makes the cap soft
  -- for anyone who saves answers — deliberate, and cheaper than losing them.
  delete from public.chats c
   where c.workspace_id = p_workspace_id
     and c.id in (
       select c2.id
         from public.chats c2
        where c2.workspace_id = p_workspace_id
        order by c2.created_at desc
        offset 10
     )
     and not exists (
       select 1 from public.messages m
        where m.chat_id = c.id and m.bookmarked
     );

  return v_new_id;
end;
$$;

-- Takes p_workspace_id as an argument, so an anon caller could otherwise create
-- chats in — and prune — any workspace.
revoke execute on function public.create_chat(uuid, text) from public, anon, authenticated;
grant  execute on function public.create_chat(uuid, text) to service_role;
