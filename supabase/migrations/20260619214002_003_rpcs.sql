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

create or replace function public.create_driver(p_name text, p_surname text, p_employee_number text, p_pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
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

create or replace function public.start_vehicle_session(p_driver_id uuid, p_vehicle_id uuid, p_marker_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_session_id uuid;
begin
  if not exists (select 1 from public.drivers where id = p_driver_id and active = true) then
    raise exception 'Driver not found or inactive';
  end if;
  update public.vehicle_sessions set status = 'completed', ended_at = now()
    where driver_id = p_driver_id and status = 'active';
  update public.vehicles set status = 'assigned' where id = p_vehicle_id;
  insert into public.vehicle_sessions (driver_id, vehicle_id, status)
  values (p_driver_id, p_vehicle_id, 'active')
  returning id into v_session_id;
  if array_length(p_marker_ids, 1) is not null then
    update public.damage_markers
      set session_id = v_session_id, reported_during = 'pre_trip'
      where id = any(p_marker_ids) and source = 'driver';
  end if;
  return v_session_id;
end;
$$;
grant execute on function public.start_vehicle_session(uuid, uuid, uuid[]) to anon;

create or replace function public.complete_vehicle_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.vehicle_sessions where id = p_session_id and status = 'active') then
    raise exception 'Session not found or already completed';
  end if;
  update public.vehicle_sessions set status = 'completed', ended_at = now() where id = p_session_id;
  update public.vehicles v set status = 'available'
    where id = (select vehicle_id from public.vehicle_sessions where id = p_session_id);
end;
$$;
grant execute on function public.complete_vehicle_session(uuid) to anon;

create or replace function public.get_vehicle_checklist(p_vehicle_id uuid, p_type text default 'pre_trip')
returns table (item_id uuid, item_text text, item_order int, item_key text, enabled boolean)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.item_text, ci.item_order, ci.item_key, coalesce(vci.enabled, true)
  from checklist_items ci
  left join vehicle_checklist_items vci on vci.checklist_item_id = ci.id and vci.vehicle_id = p_vehicle_id
  where ci.is_active = true and ci.checklist_type = p_type
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_checklist(uuid, text) to anon, authenticated;

create or replace function public.get_vehicle_enabled_checklist(p_vehicle_id uuid, p_type text default 'pre_trip')
returns table (item_id uuid, item_text text, item_order int, item_key text)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.item_text, ci.item_order, ci.item_key
  from checklist_items ci
  where ci.is_active = true and ci.checklist_type = p_type
  and (
    not exists (select 1 from vehicle_checklist_items where vehicle_id = p_vehicle_id)
    or exists (select 1 from vehicle_checklist_items vci where vci.vehicle_id = p_vehicle_id and vci.checklist_item_id = ci.id and vci.enabled = true)
    or not exists (select 1 from vehicle_checklist_items vci where vci.vehicle_id = p_vehicle_id and vci.checklist_item_id = ci.id)
  )
  order by ci.item_order;
$$;
grant execute on function public.get_vehicle_enabled_checklist(uuid, text) to anon, authenticated;