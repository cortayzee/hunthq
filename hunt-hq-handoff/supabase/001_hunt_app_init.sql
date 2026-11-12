-- ALREADY APPLIED to Supabase project mdzvqqhreqaxyclbjqbb (formerly "Fantasy HQ") on 2026-11-12.
-- Kept for reference / re-creation. Do not re-run against that project.
create table public.hunt_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'note',            -- kill | sighting | stand | camp | trailcam | access | note
  name text, species text, sex text, hunter text default 'Me',
  lat double precision not null, lon double precision not null,
  observed_at timestamptz, wmu text, weapon text, notes text, source text,
  extra jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create table public.hunt_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date_start date not null, date_end date, hunter text default 'Me',
  species text, wmu text, area text, weapon text, hours numeric,
  result text,                                   -- harvest | missed | seen | nothing
  animals_seen int, weather text, wind text, temp_c numeric,
  lat double precision, lon double precision, notes text,
  created_at timestamptz default now()
);
create table public.hunt_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text, hunter text default 'Me', started_at timestamptz,
  coords jsonb not null,                         -- [[lon,lat,(ele),(iso time)], ...]
  distance_km numeric, source text,
  created_at timestamptz default now()
);
create table public.hunt_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null, species text not null, tag_type text, cost numeric,
  wmu text, filled boolean default false, hunter text default 'Me', notes text,
  created_at timestamptz default now()
);
create table public.hunt_leh (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null, species text, hunt_code text, zone text, class text,
  choice int, drawn boolean, odds numeric, hunter text default 'Me', notes text,
  created_at timestamptz default now()
);
create table public.hunt_prefs (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,       -- LEH goals, imported draw-odds stats, UI settings
  updated_at timestamptz default now()
);
-- RLS: every table, owner-only select/insert/update/delete via (select auth.uid()) = user_id; index on user_id.
