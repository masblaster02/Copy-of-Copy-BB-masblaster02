-- 007_vehicle_checklists.sql
-- Vehicle-specific pre-trip checklists

-- Checklist templates (can be shared across vehicles or customized per vehicle)
create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Checklist items within a template
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  item_text text not null,
  item_order int not null default 0,
  requires_photo_on_issue boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Link vehicles to checklist templates (one template per vehicle)
create table if not exists public.vehicle_checklist_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (vehicle_id)
);

-- Indexes for performance
create index if not exists idx_checklist_items_template on public.checklist_items(template_id);
create index if not exists idx_vehicle_checklist_vehicle on public.vehicle_checklist_assignments(vehicle_id);

-- RLS
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.vehicle_checklist_assignments enable row level security;

-- Admin full access
create policy admin_all_checklist_templates on public.checklist_templates
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy admin_all_checklist_items on public.checklist_items
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy admin_all_vehicle_checklist on public.vehicle_checklist_assignments
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Driver (anon) read access
create policy anon_read_checklist_templates on public.checklist_templates
  for select to anon using (true);
create policy anon_read_checklist_items on public.checklist_items
  for select to anon using (true);
create policy anon_read_vehicle_checklist on public.vehicle_checklist_assignments
  for select to anon using (true);

-- Grants
grant select, insert, update, delete on public.checklist_templates, public.checklist_items, public.vehicle_checklist_assignments to authenticated;
grant select on public.checklist_templates, public.checklist_items, public.vehicle_checklist_assignments to anon;
grant all on public.checklist_templates, public.checklist_items, public.vehicle_checklist_assignments to service_role;

-- Insert default template with standard items
insert into public.checklist_templates (name, description, is_default)
values ('Standard Pre-Trip Checklist', 'Default checklist for all vehicles', true)
on conflict do nothing;

-- Get the default template ID and insert items
do $$
declare
  template_id uuid;
begin
  select id into template_id from public.checklist_templates where is_default = true limit 1;
  if template_id is not null then
    insert into public.checklist_items (template_id, item_text, item_order) values
      (template_id, 'Tyres (tread, pressure, damage)', 1),
      (template_id, 'Lights (head, brake, indicators)', 2),
      (template_id, 'Windows & mirrors', 3),
      (template_id, 'Wipers & washer fluid', 4),
      (template_id, 'Body damage (exterior walk-around)', 5),
      (template_id, 'Fluid leaks underneath', 6),
      (template_id, 'Fuel / charge level', 7),
      (template_id, 'Dashboard warning lights', 8),
      (template_id, 'Brakes feel', 9),
      (template_id, 'Horn', 10),
      (template_id, 'Seatbelts & interior cleanliness', 11)
    on conflict do nothing;
  end if;
end $$;

-- Function to get checklist for a vehicle (returns default if no assignment)
create or replace function public.get_vehicle_checklist(p_vehicle_id uuid)
returns table (item_id uuid, item_text text, item_order int, requires_photo_on_issue boolean)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.item_text, ci.item_order, ci.requires_photo_on_issue
  from checklist_items ci
  where ci.template_id = (
    select coalesce(vca.template_id, (select id from checklist_templates where is_default = true limit 1))
    from vehicle_checklist_assignments vca
    where vca.vehicle_id = p_vehicle_id
  )
  and ci.is_active = true
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_checklist(uuid) to anon, authenticated;

-- Trigger to update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_checklist_templates_updated_at on public.checklist_templates;
create trigger update_checklist_templates_updated_at
  before update on public.checklist_templates
  for each row execute function public.update_updated_at();