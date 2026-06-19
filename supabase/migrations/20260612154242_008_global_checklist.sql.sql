-- 008_global_checklist.sql
-- Redesign: Single global checklist with per-vehicle enable toggles

-- Drop the old template-based tables if they exist
drop table if exists public.vehicle_checklist_assignments cascade;
drop table if exists public.checklist_items cascade;
drop table if exists public.checklist_templates cascade;
drop function if exists public.get_vehicle_checklist(uuid);

-- Global checklist items (one master list managed by admin)
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  item_text text not null,
  item_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Per-vehicle checklist item overrides (which items to show for each vehicle)
create table public.vehicle_checklist_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  enabled boolean not null default true,
  unique (vehicle_id, checklist_item_id)
);

-- Indexes
create index if not exists idx_checklist_items_order on public.checklist_items(item_order);
create index if not exists idx_vehicle_checklist_vehicle on public.vehicle_checklist_items(vehicle_id);
create index if not exists idx_vehicle_checklist_item on public.vehicle_checklist_items(checklist_item_id);

-- RLS
alter table public.checklist_items enable row level security;
alter table public.vehicle_checklist_items enable row level security;

-- Admin full access
create policy admin_all_checklist_items on public.checklist_items
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy admin_all_vehicle_checklist on public.vehicle_checklist_items
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Driver (anon) read access
create policy anon_read_checklist_items on public.checklist_items
  for select to anon using (is_active = true);
create policy anon_read_vehicle_checklist on public.vehicle_checklist_items
  for select to anon using (enabled = true);

-- Grants
grant select, insert, update, delete on public.checklist_items, public.vehicle_checklist_items to authenticated;
grant select on public.checklist_items, public.vehicle_checklist_items to anon;
grant all on public.checklist_items, public.vehicle_checklist_items to service_role;

-- Insert default items
insert into public.checklist_items (item_text, item_order) values
  ('Tyres (tread, pressure, damage)', 1),
  ('Lights (head, brake, indicators)', 2),
  ('Windows & mirrors', 3),
  ('Wipers & washer fluid', 4),
  ('Body damage (exterior walk-around)', 5),
  ('Fluid leaks underneath', 6),
  ('Fuel / charge level', 7),
  ('Dashboard warning lights', 8),
  ('Brakes feel', 9),
  ('Horn', 10),
  ('Seatbelts & interior cleanliness', 11)
on conflict do nothing;

-- Function to get checklist for a vehicle
-- Returns ALL active items, with an 'enabled' flag indicating if vehicle has override
create or replace function public.get_vehicle_checklist(p_vehicle_id uuid)
returns table (
  item_id uuid,
  item_text text,
  item_order int,
  enabled boolean
)
language sql stable security definer set search_path = public as $$
  select 
    ci.id as item_id,
    ci.item_text,
    ci.item_order,
    coalesce(vci.enabled, true) as enabled
  from checklist_items ci
  left join vehicle_checklist_items vci 
    on vci.checklist_item_id = ci.id and vci.vehicle_id = p_vehicle_id
  where ci.is_active = true
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_checklist(uuid) to anon, authenticated;

-- Function to get ONLY enabled items for a vehicle (for driver pre-trip)
create or replace function public.get_vehicle_enabled_checklist(p_vehicle_id uuid)
returns table (
  item_id uuid,
  item_text text,
  item_order int
)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.item_text, ci.item_order
  from checklist_items ci
  where ci.is_active = true
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
grant execute on function public.get_vehicle_enabled_checklist(uuid) to anon, authenticated;

-- Trigger function to auto-populate vehicle_checklist_items for new vehicles
-- (all items enabled by default)
create or replace function public.populate_vehicle_checklist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into vehicle_checklist_items (vehicle_id, checklist_item_id, enabled)
  select NEW.id, id, true from checklist_items where is_active = true;
  return NEW;
end;
$$;

-- Note: We don't auto-populate existing vehicles; admin can toggle per vehicle