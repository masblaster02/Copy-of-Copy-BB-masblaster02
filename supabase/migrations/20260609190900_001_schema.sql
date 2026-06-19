-- Fleet Guardian — schema.sql
-- Core tables, enums, RLS policies, grants, and RPC functions

create extension if not exists pgcrypto;

-- ----- ENUMS -----
do $$ begin create type app_role as enum ('admin'); exception when duplicate_object then null; end $$;
do $$ begin create type vehicle_status as enum ('available','assigned','maintenance','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type session_status as enum ('active','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type inspection_type as enum ('pre_trip','return'); exception when duplicate_object then null; end $$;
do $$ begin create type inspection_result as enum ('pass','issue'); exception when duplicate_object then null; end $$;
do $$ begin create type damage_status as enum ('open','in_review','repaired','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type damage_type as enum ('scratch','dent','crack','paint','missing_part','other'); exception when duplicate_object then null; end $$;
do $$ begin create type blueprint_view as enum ('front','rear','left','right','roof','interior'); exception when duplicate_object then null; end $$;

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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

-- ----- VEHICLE SESSIONS -----
create table if not exists public.vehicle_sessions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status session_status not null default 'active'
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
  created_at timestamptz not null default now()
);

create table if not exists public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  item_name text not null,
  result inspection_result not null,
  notes text
);

create table if not exists public.inspection_item_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_item_id uuid not null references public.inspection_items(id) on delete cascade,
  photo_url text not null
);

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
  reported_at timestamptz not null default now()
);

create table if not exists public.damage_marker_photos (
  id uuid primary key default gen_random_uuid(),
  damage_marker_id uuid not null references public.damage_markers(id) on delete cascade,
  photo_url text not null
);

create table if not exists public.vehicle_blueprints (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  blueprint_image text not null
);

create table if not exists public.vehicle_base_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  photo_url text not null
);

-- ============================================================
-- GRANTS
-- ============================================================
grant select on public.user_roles to authenticated;
grant all    on public.user_roles to service_role;

grant select, insert, update, delete on public.drivers, public.vehicles, public.vehicle_sessions,
  public.inspections, public.inspection_items, public.inspection_item_photos,
  public.damage_markers, public.damage_marker_photos, public.vehicle_blueprints, public.vehicle_base_photos
  to authenticated;

grant select on public.vehicles, public.damage_markers, public.vehicle_blueprints to anon;
grant select, insert, update on public.vehicle_sessions to anon;
grant select, insert on public.inspections, public.inspection_items, public.inspection_item_photos to anon;
grant select, insert, update on public.damage_markers to anon;
grant insert on public.damage_marker_photos to anon;

grant all on all tables in schema public to service_role;

-- ============================================================
-- ROW LEVEL SECURITY
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

-- Admin: full access via has_role()
do $$ declare t text;
begin
  for t in select unnest(array[
    'drivers','vehicles','vehicle_sessions','inspections','inspection_items',
    'inspection_item_photos','damage_markers','damage_marker_photos',
    'vehicle_blueprints','vehicle_base_photos'])
  loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;

-- Drivers (anonymous role used by PIN-authed drivers)
drop policy if exists anon_vehicles_read on public.vehicles;
create policy anon_vehicles_read on public.vehicles for select to anon using (true);

drop policy if exists anon_blueprints_read on public.vehicle_blueprints;
create policy anon_blueprints_read on public.vehicle_blueprints for select to anon using (true);

drop policy if exists anon_damage_read on public.damage_markers;
create policy anon_damage_read on public.damage_markers for select to anon using (true);

drop policy if exists anon_damage_insert on public.damage_markers;
create policy anon_damage_insert on public.damage_markers for insert to anon with check (true);

drop policy if exists anon_damage_photo_insert on public.damage_marker_photos;
create policy anon_damage_photo_insert on public.damage_marker_photos for insert to anon with check (true);

drop policy if exists anon_session_rw on public.vehicle_sessions;
create policy anon_session_rw on public.vehicle_sessions for all to anon using (true) with check (true);

drop policy if exists anon_inspections_rw on public.inspections;
create policy anon_inspections_rw on public.inspections for all to anon using (true) with check (true);

drop policy if exists anon_inspection_items_rw on public.inspection_items;
create policy anon_inspection_items_rw on public.inspection_items for all to anon using (true) with check (true);

drop policy if exists anon_inspection_photos_rw on public.inspection_item_photos;
create policy anon_inspection_photos_rw on public.inspection_item_photos for all to anon using (true) with check (true);

-- ============================================================
-- DRIVER PIN RPCs
-- ============================================================
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

create or replace function public.set_driver_pin(p_driver_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Not authorized'; end if;
  update public.drivers set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_driver_id;
end $$;
grant execute on function public.set_driver_pin(uuid, text) to authenticated;