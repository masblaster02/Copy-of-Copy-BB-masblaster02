-- ============================================================
-- 003_blueprint_images.sql
-- Per-view blueprint images for each vehicle.
-- Run in SQL editor AFTER 002_base_photos_links.sql.
-- Also create a PUBLIC storage bucket named: vehicle-blueprints
-- ============================================================

-- Add view + uniqueness so each vehicle has at most one image per view
alter table public.vehicle_blueprints
  add column if not exists view blueprint_view,
  add column if not exists updated_at timestamptz not null default now();

-- Allow nullable initially for legacy rows, then enforce going forward
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'vehicle_blueprints_vehicle_view_unique'
  ) then
    alter table public.vehicle_blueprints
      add constraint vehicle_blueprints_vehicle_view_unique unique (vehicle_id, view);
  end if;
end $$;

-- Grants (idempotent)
grant select, insert, update, delete on public.vehicle_blueprints to authenticated;
grant select on public.vehicle_blueprints to anon;
grant all on public.vehicle_blueprints to service_role;

-- RLS — admin full access, anon read
alter table public.vehicle_blueprints enable row level security;

drop policy if exists admin_all on public.vehicle_blueprints;
create policy admin_all on public.vehicle_blueprints
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists anon_blueprints_read on public.vehicle_blueprints;
create policy anon_blueprints_read on public.vehicle_blueprints
  for select to anon using (true);
