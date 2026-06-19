-- 002_base_photos_links.sql
-- Adds: base photos grouped by view, baseline damage markers
-- linked to base photos, and driver-reported damage with photos.

-- ---- vehicle_base_photos: add view + label + created_at ----
alter table public.vehicle_base_photos
  add column if not exists view blueprint_view,
  add column if not exists label text,
  add column if not exists created_at timestamptz not null default now();

-- ---- damage_markers: source flag (baseline vs driver) ----
do $$ begin
  create type damage_source as enum ('baseline','driver');
exception when duplicate_object then null;
end $$;

alter table public.damage_markers
  add column if not exists source damage_source not null default 'driver';

-- ---- link table: baseline marker <-> base photos ----
create table if not exists public.damage_marker_base_photos (
  id uuid primary key default gen_random_uuid(),
  damage_marker_id uuid not null references public.damage_markers(id) on delete cascade,
  base_photo_id uuid not null references public.vehicle_base_photos(id) on delete cascade,
  unique (damage_marker_id, base_photo_id)
);
create index if not exists idx_dmbp_marker on public.damage_marker_base_photos(damage_marker_id);

-- ---- grants ----
grant select, insert, update, delete on public.vehicle_base_photos to authenticated;
grant select, insert, update, delete on public.damage_marker_base_photos to authenticated;
grant select on public.vehicle_base_photos to anon;
grant select on public.damage_marker_base_photos to anon;
grant all on public.vehicle_base_photos to service_role;
grant all on public.damage_marker_base_photos to service_role;

-- ---- RLS ----
alter table public.damage_marker_base_photos enable row level security;

drop policy if exists admin_all on public.damage_marker_base_photos;
create policy admin_all on public.damage_marker_base_photos
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists anon_dmbp_read on public.damage_marker_base_photos;
create policy anon_dmbp_read on public.damage_marker_base_photos
  for select to anon using (true);

drop policy if exists anon_base_photos_read on public.vehicle_base_photos;
create policy anon_base_photos_read on public.vehicle_base_photos
  for select to anon using (true);