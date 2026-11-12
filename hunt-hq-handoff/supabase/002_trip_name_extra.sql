-- APPLIED to project mdzvqqhreqaxyclbjqbb on 2026-11-12 (migration hunt_trips_name_extra).
-- Hunts get a display name and an extra jsonb (party list etc.). Waypoints link to hunts via hunt_spots.extra.trip_id
-- and to user-made groups via hunt_spots.extra.group_id (groups live in hunt_prefs.data.groups).
alter table public.hunt_trips add column if not exists name text;
alter table public.hunt_trips add column if not exists extra jsonb default '{}'::jsonb;
