-- PicklePulse: multi-club schema. Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ───────── tables ─────────
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  name text not null,
  logo_url text,
  color_primary text not null default '#c6ff1a',
  color_bg text not null default '#0b1220',
  theme text not null default 'neon',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','scorekeeper')),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name text not null,
  status text not null default 'draft' check (status in ('draft','live','finished')),
  is_public boolean not null default true,
  config jsonb not null,               -- EventConfig (see src/lib/engine/types.ts)
  created_at timestamptz not null default now(),
  unique (club_id, slug)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  level text not null check (level in ('novice','low_intermediate','high_intermediate','advanced')),
  logo_url text,
  color text,
  sort int not null default 0
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  name text not null,
  gender text check (gender in ('M','W'))
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null,                  -- G01...
  n int not null,
  pool_id text not null,
  level text not null,
  category text,
  entry_a uuid not null references public.entries(id) on delete cascade,
  entry_b uuid not null references public.entries(id) on delete cascade,
  slot int not null,
  court int not null,
  unique (event_id, code)
);

create table public.results (
  match_id uuid primary key references public.matches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  score_a int not null default 0,
  score_b int not null default 0,
  final boolean not null default false,
  players_a uuid[] not null default '{}',
  players_b uuid[] not null default '{}',
  entry_a uuid references public.entries(id),   -- set when a different entry actually played
  entry_b uuid references public.entries(id),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

-- the "ongoing game" of every court is independent
create table public.court_cursors (
  event_id uuid not null references public.events(id) on delete cascade,
  court int not null,
  slot int not null,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (event_id, court)
);

create index on public.entries (event_id);
create index on public.players (event_id, entry_id);
create index on public.matches (event_id, slot, court);
create index on public.results (event_id);

-- ───────── helpers (security definer so policies don't recurse) ─────────
create function public.is_club_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_members where club_id = c and user_id = auth.uid())
$$;
create function public.is_club_owner(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_members where club_id = c and user_id = auth.uid() and role = 'owner')
$$;
create function public.event_club(e uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select club_id from events where id = e
$$;
create function public.event_is_public(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_public and status <> 'draft' from events where id = e), false)
$$;

-- creating a club also makes the creator its owner
create function public.create_club(p_name text, p_slug text) returns public.clubs
language plpgsql security definer set search_path = public as $$
declare c public.clubs;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into clubs (name, slug, created_by) values (p_name, p_slug, auth.uid()) returning * into c;
  insert into club_members (club_id, user_id, role) values (c.id, auth.uid(), 'owner');
  return c;
end $$;

-- ───────── row level security ─────────
alter table public.clubs         enable row level security;
alter table public.club_members  enable row level security;
alter table public.events        enable row level security;
alter table public.entries       enable row level security;
alter table public.players       enable row level security;
alter table public.matches       enable row level security;
alter table public.results       enable row level security;
alter table public.court_cursors enable row level security;

-- clubs: branding is public (public pages need it); only owners change it
create policy clubs_read   on public.clubs for select using (true);
create policy clubs_update on public.clubs for update using (public.is_club_owner(id));
create policy clubs_delete on public.clubs for delete using (public.is_club_owner(id));

create policy members_read   on public.club_members for select using (public.is_club_member(club_id));
create policy members_manage on public.club_members for all
  using (public.is_club_owner(club_id)) with check (public.is_club_owner(club_id));

-- events: public when live/finished, otherwise members only; owners write
create policy events_read on public.events for select
  using ((is_public and status <> 'draft') or public.is_club_member(club_id));
create policy events_write on public.events for all
  using (public.is_club_owner(club_id)) with check (public.is_club_owner(club_id));

-- setup data (entries, players, matches): public read with the event, owner write
create policy entries_read on public.entries for select
  using (public.event_is_public(event_id) or public.is_club_member(public.event_club(event_id)));
create policy entries_write on public.entries for all
  using (public.is_club_owner(public.event_club(event_id))) with check (public.is_club_owner(public.event_club(event_id)));

create policy players_read on public.players for select
  using (public.event_is_public(event_id) or public.is_club_member(public.event_club(event_id)));
create policy players_write on public.players for all
  using (public.is_club_owner(public.event_club(event_id))) with check (public.is_club_owner(public.event_club(event_id)));

create policy matches_read on public.matches for select
  using (public.event_is_public(event_id) or public.is_club_member(public.event_club(event_id)));
create policy matches_write on public.matches for all
  using (public.is_club_owner(public.event_club(event_id))) with check (public.is_club_owner(public.event_club(event_id)));

-- live data (results, cursors): owners AND scorekeepers write
create policy results_read on public.results for select
  using (public.event_is_public(event_id) or public.is_club_member(public.event_club(event_id)));
create policy results_write on public.results for all
  using (public.is_club_member(public.event_club(event_id))) with check (public.is_club_member(public.event_club(event_id)));

create policy cursors_read on public.court_cursors for select
  using (public.event_is_public(event_id) or public.is_club_member(public.event_club(event_id)));
create policy cursors_write on public.court_cursors for all
  using (public.is_club_member(public.event_club(event_id))) with check (public.is_club_member(public.event_club(event_id)));

-- ───────── realtime ─────────
alter publication supabase_realtime add table public.results, public.court_cursors, public.matches, public.entries, public.events;

-- ───────── storage: logos ─────────
insert into storage.buckets (id, name, public) values ('branding', 'branding', true) on conflict do nothing;
create policy branding_read on storage.objects for select using (bucket_id = 'branding');
create policy branding_write on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_club_owner(((storage.foldername(name))[1])::uuid));
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_club_owner(((storage.foldername(name))[1])::uuid));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_club_owner(((storage.foldername(name))[1])::uuid));
