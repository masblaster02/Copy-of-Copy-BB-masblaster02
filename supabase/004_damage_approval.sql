-- ============================================================
-- 004_damage_approval.sql
-- Adds admin approval workflow for driver-reported damage.
-- Run in SQL editor AFTER 003_blueprint_images.sql.
--
-- Rules:
--   * Driver-reported markers are inserted with approved = false.
--     Spot is visible to everyone (so it shows on the blueprint),
--     but linked photos are only visible once approved.
--   * Admin-created (baseline) markers are auto-approved.
--   * damage_marker_photos rows can be individually approved/rejected
--     by the admin. Only approved photos are returned to anon.
-- ============================================================

alter table public.damage_markers
  add column if not exists approved boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id);

-- Backfill: baseline markers and any existing markers are considered approved
update public.damage_markers set approved = true where approved = false and source = 'baseline';

alter table public.damage_marker_photos
  add column if not exists approved boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists uploaded_at timestamptz not null default now();

-- ----- RLS: restrict anon reads to approved photos only -----
alter table public.damage_marker_photos enable row level security;

drop policy if exists admin_all on public.damage_marker_photos;
create policy admin_all on public.damage_marker_photos
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists anon_damage_photo_read_approved on public.damage_marker_photos;
create policy anon_damage_photo_read_approved on public.damage_marker_photos
  for select to anon using (approved = true);

-- Keep insert path open for drivers (anon) — they create photos pending approval
drop policy if exists anon_damage_photo_insert on public.damage_marker_photos;
create policy anon_damage_photo_insert on public.damage_marker_photos
  for insert to anon with check (true);

-- ----- Grants (idempotent) -----
grant select, insert, update, delete on public.damage_marker_photos to authenticated;
grant select, insert on public.damage_marker_photos to anon;
grant all on public.damage_marker_photos to service_role;
