-- 010_return_checklist_special_items

alter table public.checklist_items
  add column if not exists item_key text unique;

-- Remove the 6 generic return items added in migration 009
delete from public.checklist_items
  where checklist_type = 'return'
  and item_key is null;

-- Insert the 3 canonical return items with special keys
insert into public.checklist_items (item_text, item_order, checklist_type, is_active, item_key) values
  ('New Damage?',     1, 'return', true, 'new_damage'),
  ('Fuel Level',      2, 'return', true, 'fuel_level'),
  ('Warning Lights?', 3, 'return', true, 'warning_lights')
on conflict (item_key) do nothing;

-- Drop and recreate functions with updated return types
drop function if exists public.get_vehicle_checklist(uuid, text);
drop function if exists public.get_vehicle_checklist(uuid);
drop function if exists public.get_vehicle_enabled_checklist(uuid, text);
drop function if exists public.get_vehicle_enabled_checklist(uuid);

create function public.get_vehicle_checklist(p_vehicle_id uuid, p_type text default 'pre_trip')
returns table (
  item_id   uuid,
  item_text text,
  item_order int,
  item_key  text,
  enabled   boolean
)
language sql stable security definer set search_path = public as $$
  select
    ci.id          as item_id,
    ci.item_text,
    ci.item_order,
    ci.item_key,
    coalesce(vci.enabled, true) as enabled
  from checklist_items ci
  left join vehicle_checklist_items vci
    on vci.checklist_item_id = ci.id and vci.vehicle_id = p_vehicle_id
  where ci.is_active = true
  and   ci.checklist_type = p_type
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_checklist(uuid, text) to anon, authenticated;

create function public.get_vehicle_enabled_checklist(p_vehicle_id uuid, p_type text default 'pre_trip')
returns table (
  item_id   uuid,
  item_text text,
  item_order int,
  item_key  text
)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.item_text, ci.item_order, ci.item_key
  from checklist_items ci
  where ci.is_active = true
  and   ci.checklist_type = p_type
  and (
    not exists (select 1 from vehicle_checklist_items where vehicle_id = p_vehicle_id)
    or exists (
      select 1 from vehicle_checklist_items vci
      where vci.vehicle_id = p_vehicle_id
      and   vci.checklist_item_id = ci.id
      and   vci.enabled = true
    )
    or not exists (
      select 1 from vehicle_checklist_items vci
      where vci.vehicle_id = p_vehicle_id
      and   vci.checklist_item_id = ci.id
    )
  )
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_enabled_checklist(uuid, text) to anon, authenticated;
