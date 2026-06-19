-- ============================================================
-- Fleet Guardian - Complete Database Migration
-- ============================================================
-- Run this entire script in your Supabase SQL Editor to set up
-- the complete Fleet Guardian database schema.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- SECTION 1: ENUMS
-- ============================================================

do $$ begin create type app_role as enum ('admin'); exception when duplicate_object then null; end $$;
do $$ begin create type vehicle_status as enum ('available','assigned','maintenance','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type session_status as enum ('active','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type inspection_type as enum ('pre_trip','return'); exception when duplicate_object then null; end $$;
do $$ begin create type inspection_result as enum ('pass','issue'); exception when duplicate_object then null; end $$;
do $$ begin create type damage_status as enum ('open','in_review','repaired','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type damage_type as enum ('scratch','dent','crack','paint','missing_part','other'); exception when duplicate_object then null; end $$;
do $$ begin create type blueprint_view as enum ('front','rear','left','right','roof','interior'); exception when duplicate_object then null; end $$;
do $$ begin create type damage_source as enum ('baseline','driver'); exception when duplicate_object then null; end $$;

-- ============================================================
-- SECTION 2: BASE TABLES
-- ============================================================

-- ----- USER ROLES -----
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- ----- DRIVERS -----
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surname text not null,
  employee_number text not null unique,
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  mobile text,
  licence_number text,
  licence_type text check (licence_type in ('local', 'international')),
  licence_category text,
  cpc_valid boolean not null default false,
  cpc_expiry_date date
);

-- ----- VEHICLES -----
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  make text not null,
  model text not null,
  year int,
  vin text,
  status vehicle_status not null default 'available',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  road_licence_date date,
  road_licence_due date,
  last_service_date date,
  service_due_date date
);

-- ----- VEHICLE SESSIONS -----
create table if not exists public.vehicle_sessions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status session_status not null default 'active',
  odometer_start numeric,
  odometer_end numeric
);
create index if not exists idx_sessions_driver on public.vehicle_sessions(driver_id);
create index if not exists idx_sessions_vehicle on public.vehicle_sessions(vehicle_id);

-- ----- INSPECTIONS -----
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.vehicle_sessions(id) on delete cascade,
  driver_id uuid not null references public.drivers(id),
  vehicle_id uuid not null references public.vehicles(id),
  inspection_type inspection_type not null,
  created_at timestamptz not null default now(),
  items_pass_count integer not null default 0,
  items_issue_count integer not null default 0
);

create table if not exists public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  item_name text not null,
  result inspection_result not null,
  notes text
);

create index if not exists idx_inspection_items_inspection on public.inspection_items(inspection_id);

create table if not exists public.inspection_item_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_item_id uuid not null references public.inspection_items(id) on delete cascade,
  photo_url text not null
);

create index if not exists idx_inspection_item_photos_item on public.inspection_item_photos(inspection_item_id);

-- ----- DAMAGE -----
create table if not exists public.damage_markers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid references public.drivers(id),
  damage_type damage_type not null,
  description text,
  status damage_status not null default 'open',
  x_coordinate numeric not null,
  y_coordinate numeric not null,
  view blueprint_view not null,
  reported_at timestamptz not null default now(),
  source damage_source not null default 'driver',
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejection_reason text,
  session_id uuid references public.vehicle_sessions(id) on delete set null,
  reported_during text check (reported_during in ('pre_trip', 'return'))
);

create index if not exists idx_damage_markers_vehicle on public.damage_markers(vehicle_id);
create index if not exists idx_damage_markers_driver on public.damage_markers(driver_id);
create index if not exists idx_damage_markers_session on public.damage_markers(session_id);
create index if not exists idx_damage_markers_reported_during on public.damage_markers(reported_during);
create index if not exists idx_damages_pending_approval on public.damage_markers(source, approved, status)
  where source = 'driver' and approved = false;
create index if not exists idx_damages_admin_list on public.damage_markers(reported_at desc);

create table if not exists public.damage_marker_photos (
  id uuid primary key default gen_random_uuid(),
  damage_marker_id uuid not null references public.damage_markers(id) on delete cascade,
  photo_url text not null,
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_damage_photos_marker on public.damage_marker_photos(damage_marker_id);

create table if not exists public.vehicle_blueprints (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  blueprint_image text not null,
  view blueprint_view,
  updated_at timestamptz not null default now(),
  constraint vehicle_blueprints_vehicle_view_unique unique (vehicle_id, view)
);

create table if not exists public.vehicle_base_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  photo_url text not null,
  view blueprint_view,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_base_photos_vehicle on public.vehicle_base_photos(vehicle_id);

create table if not exists public.damage_marker_base_photos (
  id uuid primary key default gen_random_uuid(),
  damage_marker_id uuid not null references public.damage_markers(id) on delete cascade,
  base_photo_id uuid not null references public.vehicle_base_photos(id) on delete cascade,
  unique (damage_marker_id, base_photo_id)
);

create index if not exists idx_dmbp_marker on public.damage_marker_base_photos(damage_marker_id);

-- ----- CHECKLISTS -----
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  item_text text not null,
  item_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  checklist_type text not null default 'pre_trip' check (checklist_type in ('pre_trip', 'return')),
  item_key text unique
);

create index if not exists idx_checklist_items_order on public.checklist_items(item_order);

create table public.vehicle_checklist_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  enabled boolean not null default true,
  unique (vehicle_id, checklist_item_id)
);

create index if not exists idx_vehicle_checklist_vehicle on public.vehicle_checklist_items(vehicle_id);
create index if not exists idx_vehicle_checklist_item on public.vehicle_checklist_items(checklist_item_id);

-- ----- VEHICLE LOGBOOKS -----
create table if not exists vehicle_logbooks (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now()
);

-- ----- VEHICLE REPAIRS -----
create table if not exists vehicle_repairs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  repair_date date not null,
  description text not null,
  cost numeric(10, 2),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION 3: GRANTS
-- ============================================================

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select, insert, update, delete on public.drivers, public.vehicles, public.vehicle_sessions,
  public.inspections, public.inspection_items, public.inspection_item_photos,
  public.damage_markers, public.damage_marker_photos, public.vehicle_blueprints, public.vehicle_base_photos,
  public.checklist_items, public.vehicle_checklist_items, public.damage_marker_base_photos,
  public.vehicle_logbooks, public.vehicle_repairs
  to authenticated;

grant select on public.vehicles, public.damage_markers, public.vehicle_blueprints to anon;
grant select, insert on public.vehicle_sessions to anon;
grant select, insert on public.inspections, public.inspection_items, public.inspection_item_photos to anon;
grant select, insert on public.damage_markers to anon;
grant insert on public.damage_marker_photos to anon;
grant select on public.checklist_items, public.vehicle_checklist_items to anon;
grant select on public.vehicle_base_photos, public.damage_marker_base_photos to anon;

grant all on all tables in schema public to service_role;

-- ============================================================
-- SECTION 4: ROW LEVEL SECURITY
-- ============================================================

alter table public.user_roles enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_sessions enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;
alter table public.inspection_item_photos enable row level security;
alter table public.damage_markers enable row level security;
alter table public.damage_marker_photos enable row level security;
alter table public.vehicle_blueprints enable row level security;
alter table public.vehicle_base_photos enable row level security;
alter table public.damage_marker_base_photos enable row level security;
alter table public.checklist_items enable row level security;
alter table public.vehicle_checklist_items enable row level security;
alter table public.vehicle_logbooks enable row level security;
alter table public.vehicle_repairs enable row level security;

-- Admin: full access via has_role()
do $$ declare t text;
begin
  for t in select unnest(array[
    'drivers','vehicles','vehicle_sessions','inspections','inspection_items',
    'inspection_item_photos','damage_markers','damage_marker_photos',
    'vehicle_blueprints','vehicle_base_photos','damage_marker_base_photos',
    'vehicle_logbooks','vehicle_repairs'])
  loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;

-- Checklist items policies
drop policy if exists admin_all_checklist_items on public.checklist_items;
create policy admin_all_checklist_items on public.checklist_items
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists admin_all_vehicle_checklist on public.vehicle_checklist_items;
create policy admin_all_vehicle_checklist on public.vehicle_checklist_items
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists anon_read_checklist_items on public.checklist_items;
create policy anon_read_checklist_items on public.checklist_items
  for select to anon using (is_active = true);

drop policy if exists anon_read_vehicle_checklist on public.vehicle_checklist_items;
create policy anon_read_vehicle_checklist on public.vehicle_checklist_items
  for select to anon using (enabled = true);

-- Anon (driver) policies
drop policy if exists anon_vehicles_read on public.vehicles;
create policy anon_vehicles_read on public.vehicles for select to anon using (true);

drop policy if exists anon_blueprints_read on public.vehicle_blueprints;
create policy anon_blueprints_read on public.vehicle_blueprints for select to anon using (true);

drop policy if exists anon_damage_read on public.damage_markers;
create policy anon_damage_read on public.damage_markers for select to anon
  using (source = 'baseline' or approved = true);

drop policy if exists anon_damage_insert on public.damage_markers;
create policy anon_damage_insert on public.damage_markers for insert to anon with check (true);

drop policy if exists anon_damage_photo_insert on public.damage_marker_photos;
create policy anon_damage_photo_insert on public.damage_marker_photos for insert to anon with check (true);

drop policy if exists anon_damage_photo_read_approved on public.damage_marker_photos;
create policy anon_damage_photo_read_approved on public.damage_marker_photos
  for select to anon using (approved = true);

drop policy if exists anon_sessions_select on public.vehicle_sessions;
create policy anon_sessions_select on public.vehicle_sessions
  for select to anon using (true);

drop policy if exists anon_sessions_insert on public.vehicle_sessions;
create policy anon_sessions_insert on public.vehicle_sessions
  for insert to anon with check (true);

drop policy if exists anon_inspections_rw on public.inspections;
create policy anon_inspections_rw on public.inspections for all to anon using (true) with check (true);

drop policy if exists anon_inspection_items_rw on public.inspection_items;
create policy anon_inspection_items_rw on public.inspection_items for all to anon using (true) with check (true);

drop policy if exists anon_inspection_photos_rw on public.inspection_item_photos;
create policy anon_inspection_photos_rw on public.inspection_item_photos for all to anon using (true) with check (true);

drop policy if exists anon_base_photos_read on public.vehicle_base_photos;
create policy anon_base_photos_read on public.vehicle_base_photos
  for select to anon using (true);

drop policy if exists anon_dmbp_read on public.damage_marker_base_photos;
create policy anon_dmbp_read on public.damage_marker_base_photos
  for select to anon using (true);

-- ============================================================
-- SECTION 5: RPC FUNCTIONS
-- ============================================================

-- Driver PIN verification
create or replace function public.verify_driver_pin(p_employee_number text, p_pin text)
returns table (driver_id uuid, employee_number text, name text, surname text)
language plpgsql security definer set search_path = public, extensions as $$
declare d record;
begin
  select id, drivers.employee_number, drivers.name, drivers.surname, pin_hash, active
    into d from public.drivers where drivers.employee_number = p_employee_number;
  if not found or d.active = false then return; end if;
  if crypt(p_pin, d.pin_hash) <> d.pin_hash then return; end if;
  driver_id := d.id; employee_number := d.employee_number; name := d.name; surname := d.surname;
  return next;
end $$;
grant execute on function public.verify_driver_pin(text, text) to anon, authenticated;

-- Create driver (admin only)
create or replace function public.create_driver(
  p_name text, p_surname text, p_employee_number text, p_pin text
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Not authorized'; end if;
  insert into public.drivers (name, surname, employee_number, pin_hash)
  values (p_name, p_surname, p_employee_number, crypt(p_pin, gen_salt('bf')))
  returning id into new_id;
  return new_id;
end $$;
grant execute on function public.create_driver(text, text, text, text) to authenticated;

-- Set driver PIN (admin only)
create or replace function public.set_driver_pin(p_driver_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Not authorized'; end if;
  update public.drivers set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_driver_id;
end $$;
grant execute on function public.set_driver_pin(uuid, text) to authenticated;

-- Session management RPCs
create or replace function public.start_vehicle_session(
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_marker_ids uuid[] default '{}'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_session_id uuid;
begin
  if not exists (select 1 from public.drivers where id = p_driver_id and active = true) then
    raise exception 'Driver not found or inactive';
  end if;

  -- Close any stale sessions for this driver
  update public.vehicle_sessions
    set status = 'completed', ended_at = now()
    where driver_id = p_driver_id
      and status = 'active';

  -- Set vehicle to assigned
  update public.vehicles set status = 'assigned' where id = p_vehicle_id;

  -- Create new session
  insert into public.vehicle_sessions (driver_id, vehicle_id, status)
  values (p_driver_id, p_vehicle_id, 'active')
  returning id into v_session_id;

  -- Backfill damage markers with session info
  if array_length(p_marker_ids, 1) is not null then
    update public.damage_markers
      set session_id = v_session_id, reported_during = 'pre_trip'
      where id = any(p_marker_ids)
        and source = 'driver';
  end if;

  return v_session_id;
end;
$$;
grant execute on function public.start_vehicle_session(uuid, uuid, uuid[]) to anon;

create or replace function public.complete_vehicle_session(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.vehicle_sessions where id = p_session_id and status = 'active'
  ) then
    raise exception 'Session not found or already completed';
  end if;

  update public.vehicle_sessions
    set status = 'completed', ended_at = now()
    where id = p_session_id;

  -- Set vehicle back to available
  update public.vehicles v
    set status = 'available'
    where id = (select vehicle_id from public.vehicle_sessions where id = p_session_id);
end;
$$;
grant execute on function public.complete_vehicle_session(uuid) to anon;

-- Checklist RPCs
create or replace function public.get_vehicle_checklist(p_vehicle_id uuid, p_type text default 'pre_trip')
returns table (
  item_id uuid,
  item_text text,
  item_order int,
  item_key text,
  enabled boolean
)
language sql stable security definer set search_path = public as $$
  select
    ci.id as item_id,
    ci.item_text,
    ci.item_order,
    ci.item_key,
    coalesce(vci.enabled, true) as enabled
  from checklist_items ci
  left join vehicle_checklist_items vci
    on vci.checklist_item_id = ci.id and vci.vehicle_id = p_vehicle_id
  where ci.is_active = true
  and ci.checklist_type = p_type
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_checklist(uuid, text) to anon, authenticated;

create or replace function public.get_vehicle_enabled_checklist(p_vehicle_id uuid, p_type text default 'pre_trip')
returns table (
  item_id uuid,
  item_text text,
  item_order int,
  item_key text
)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.item_text, ci.item_order, ci.item_key
  from checklist_items ci
  where ci.is_active = true
  and ci.checklist_type = p_type
  and (
    not exists (select 1 from vehicle_checklist_items where vehicle_id = p_vehicle_id)
    or exists (
      select 1 from vehicle_checklist_items vci
      where vci.vehicle_id = p_vehicle_id
      and vci.checklist_item_id = ci.id
      and vci.enabled = true
    )
    or not exists (
      select 1 from vehicle_checklist_items vci
      where vci.vehicle_id = p_vehicle_id
      and vci.checklist_item_id = ci.id
    )
  )
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_enabled_checklist(uuid, text) to anon, authenticated;

-- ============================================================
-- SECTION 6: TRIGGERS
-- ============================================================

-- Inspection count sync
create or replace function public.sync_inspection_counts()
returns trigger language plpgsql as $$
declare
  v_inspection_id uuid;
begin
  v_inspection_id := coalesce(new.inspection_id, old.inspection_id);
  update public.inspections set
    items_pass_count = (select count(*) from public.inspection_items where inspection_id = v_inspection_id and result = 'pass'),
    items_issue_count = (select count(*) from public.inspection_items where inspection_id = v_inspection_id and result = 'issue')
  where id = v_inspection_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_inspection_counts on public.inspection_items;
create trigger trg_sync_inspection_counts
  after insert or update or delete on public.inspection_items
  for each row execute function public.sync_inspection_counts();

-- ============================================================
-- SECTION 7: VIEWS
-- ============================================================

create or replace view public.vehicle_summary as
with session_stats as (
  select
    vehicle_id,
    count(*) as total_sessions,
    max(started_at) as last_used_at,
    sum(case when extract(epoch from (ended_at - started_at)) is not null
             then extract(epoch from (ended_at - started_at)) / 60 else 0 end) as total_minutes
  from public.vehicle_sessions
  group by vehicle_id
),
damage_stats as (
  select
    vehicle_id,
    count(*) filter (where status = 'open' and (source = 'baseline' or approved = true)) as open_damage_count,
    count(*) as total_damage_count
  from public.damage_markers
  group by vehicle_id
),
latest_inspection as (
  select distinct on (vehicle_id)
    vehicle_id,
    created_at as last_inspection_at,
    inspection_type as last_inspection_type,
    items_issue_count as last_inspection_issues
  from public.inspections
  order by vehicle_id, created_at desc
)
select
  v.id,
  v.registration_number,
  v.make,
  v.model,
  v.year,
  v.status,
  v.archived,
  coalesce(ss.total_sessions, 0) as total_sessions,
  ss.last_used_at,
  coalesce(ss.total_minutes, 0) as total_drive_minutes,
  coalesce(ds.open_damage_count, 0) as open_damage_count,
  coalesce(ds.total_damage_count, 0) as total_damage_count,
  li.last_inspection_at,
  li.last_inspection_type,
  coalesce(li.last_inspection_issues, 0) as last_inspection_issues
from public.vehicles v
left join session_stats ss on ss.vehicle_id = v.id
left join damage_stats ds on ds.vehicle_id = v.id
left join latest_inspection li on li.vehicle_id = v.id;

grant select on public.vehicle_summary to authenticated;

-- ============================================================
-- SECTION 8: STORAGE BUCKETS
-- ============================================================

-- vehicle-blueprints (public)
insert into storage.buckets (id, name, public, created_at)
values ('vehicle-blueprints', 'vehicle-blueprints', true, now())
on conflict (id) do nothing;

-- vehicle-base-photos (public)
insert into storage.buckets (id, name, public, created_at)
values ('vehicle-base-photos', 'vehicle-base-photos', true, now())
on conflict (id) do nothing;

-- inspection-photos (private)
insert into storage.buckets (id, name, public, created_at)
values ('inspection-photos', 'inspection-photos', false, now())
on conflict (id) do nothing;

-- damage-photos (private)
insert into storage.buckets (id, name, public, created_at)
values ('damage-photos', 'damage-photos', false, now())
on conflict (id) do nothing;

-- vehicle-logbooks (private)
insert into storage.buckets (id, name, public, created_at)
values ('vehicle-logbooks', 'vehicle-logbooks', false, now())
on conflict (id) do nothing;

-- Storage policies
drop policy if exists bp_public_read on storage.objects;
create policy bp_public_read on storage.objects
  for select to public
  using (bucket_id = 'vehicle-blueprints');

drop policy if exists bp_auth_insert on storage.objects;
create policy bp_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-blueprints');

drop policy if exists bp_auth_update on storage.objects;
create policy bp_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-blueprints')
  with check (bucket_id = 'vehicle-blueprints');

drop policy if exists bp_auth_delete on storage.objects;
create policy bp_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-blueprints');

drop policy if exists base_public_read on storage.objects;
create policy base_public_read on storage.objects
  for select to public
  using (bucket_id = 'vehicle-base-photos');

drop policy if exists base_auth_insert on storage.objects;
create policy base_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-base-photos');

drop policy if exists base_auth_update on storage.objects;
create policy base_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-base-photos')
  with check (bucket_id = 'vehicle-base-photos');

drop policy if exists base_auth_delete on storage.objects;
create policy base_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-base-photos');

drop policy if exists damage_anon_read on storage.objects;
create policy damage_anon_read on storage.objects
  for select to anon
  using (bucket_id = 'damage-photos');

drop policy if exists damage_auth_read on storage.objects;
create policy damage_auth_read on storage.objects
  for select to authenticated
  using (bucket_id = 'damage-photos');

drop policy if exists damage_anon_insert on storage.objects;
create policy damage_anon_insert on storage.objects
  for insert to anon
  with check (bucket_id = 'damage-photos');

drop policy if exists damage_auth_insert on storage.objects;
create policy damage_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'damage-photos');

drop policy if exists damage_auth_update on storage.objects;
create policy damage_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'damage-photos')
  with check (bucket_id = 'damage-photos');

drop policy if exists damage_auth_delete on storage.objects;
create policy damage_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'damage-photos');

drop policy if exists inspect_anon_read on storage.objects;
create policy inspect_anon_read on storage.objects
  for select to anon
  using (bucket_id = 'inspection-photos');

drop policy if exists inspect_auth_read on storage.objects;
create policy inspect_auth_read on storage.objects
  for select to authenticated
  using (bucket_id = 'inspection-photos');

drop policy if exists inspect_anon_insert on storage.objects;
create policy inspect_anon_insert on storage.objects
  for insert to anon
  with check (bucket_id = 'inspection-photos');

drop policy if exists inspect_auth_insert on storage.objects;
create policy inspect_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inspection-photos');

drop policy if exists inspect_auth_update on storage.objects;
create policy inspect_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'inspection-photos')
  with check (bucket_id = 'inspection-photos');

drop policy if exists inspect_auth_delete on storage.objects;
create policy inspect_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'inspection-photos');

drop policy if exists logbooks_auth_read on storage.objects;
create policy logbooks_auth_read on storage.objects
  for select to authenticated
  using (bucket_id = 'vehicle-logbooks');

drop policy if exists logbooks_auth_insert on storage.objects;
create policy logbooks_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-logbooks');

drop policy if exists logbooks_auth_update on storage.objects;
create policy logbooks_auth_update on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-logbooks')
  with check (bucket_id = 'vehicle-logbooks');

drop policy if exists logbooks_auth_delete on storage.objects;
create policy logbooks_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-logbooks');

-- ============================================================
-- SECTION 9: SEED DATA
-- ============================================================

-- Insert default checklist items
insert into public.checklist_items (item_text, item_order, checklist_type) values
  ('Tyres (tread, pressure, damage)', 1, 'pre_trip'),
  ('Lights (head, brake, indicators)', 2, 'pre_trip'),
  ('Windows & mirrors', 3, 'pre_trip'),
  ('Wipers & washer fluid', 4, 'pre_trip'),
  ('Body damage (exterior walk-around)', 5, 'pre_trip'),
  ('Fluid leaks underneath', 6, 'pre_trip'),
  ('Fuel / charge level', 7, 'pre_trip'),
  ('Dashboard warning lights', 8, 'pre_trip'),
  ('Brakes feel', 9, 'pre_trip'),
  ('Horn', 10, 'pre_trip'),
  ('Seatbelts & interior cleanliness', 11, 'pre_trip')
on conflict do nothing;

insert into public.checklist_items (item_text, item_order, checklist_type, item_key) values
  ('New Damage?', 1, 'return', 'new_damage'),
  ('Fuel Level', 2, 'return', 'fuel_level'),
  ('Warning Lights?', 3, 'return', 'warning_lights')
on conflict (item_key) do nothing;

-- ============================================================
-- SECTION 10: COLUMN COMMENTS
-- ============================================================

comment on column public.damage_markers.source is 'baseline = known/pre-existing damage, driver = newly reported by driver';
comment on column public.damage_markers.approved is 'For driver-reported damages: true after admin review';
comment on column public.damage_markers.rejection_reason is 'Reason if damage report was rejected';
comment on column public.vehicle_sessions.odometer_start is 'Optional odometer reading at session start (km)';
comment on column public.vehicle_sessions.odometer_end is 'Optional odometer reading at session end (km)';

-- ============================================================
-- END OF MIGRATION
-- ============================================================
