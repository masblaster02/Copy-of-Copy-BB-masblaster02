-- 009_return_checklist
-- Add checklist_type to differentiate pre-trip vs return checklists

alter table public.checklist_items
  add column if not exists checklist_type text not null default 'pre_trip'
  check (checklist_type in ('pre_trip', 'return'));

-- Seed default return checklist items
insert into public.checklist_items (item_text, item_order, checklist_type) values
  ('Vehicle exterior walk-around', 1, 'return'),
  ('Interior cleanliness', 2, 'return'),
  ('All personal belongings removed', 3, 'return'),
  ('Windows & mirrors intact', 4, 'return'),
  ('Tyres visually checked', 5, 'return'),
  ('Lights operational', 6, 'return')
on conflict do nothing;

-- Update get_vehicle_enabled_checklist to support checklist_type
create or replace function public.get_vehicle_enabled_checklist(p_vehicle_id uuid, p_type text default 'pre_trip')
returns table (
  item_id uuid,
  item_text text,
  item_order int
)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.item_text, ci.item_order
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

-- Update get_vehicle_checklist to support checklist_type
create or replace function public.get_vehicle_checklist(p_vehicle_id uuid, p_type text default 'pre_trip')
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
  and ci.checklist_type = p_type
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_checklist(uuid, text) to anon, authenticated;

-- anon read policy should already cover new rows (is_active = true filter)
