-- APPLIED 2026-11-12 (migration hunt_tracks_extra): routes store mode/stats/notes/trip_id/group_id in extra.
alter table public.hunt_tracks add column if not exists extra jsonb default '{}'::jsonb;
