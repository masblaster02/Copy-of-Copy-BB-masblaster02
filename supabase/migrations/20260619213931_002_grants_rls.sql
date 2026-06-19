grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant select, insert, update, delete on public.drivers, public.vehicles, public.vehicle_sessions, public.inspections, public.inspection_items, public.inspection_item_photos, public.damage_markers, public.damage_marker_photos, public.vehicle_blueprints, public.vehicle_base_photos, public.checklist_items, public.vehicle_checklist_items, public.damage_marker_base_photos, public.vehicle_logbooks, public.vehicle_repairs to authenticated;
grant select on public.vehicles, public.damage_markers, public.vehicle_blueprints to anon;
grant select, insert on public.vehicle_sessions to anon;
grant select, insert on public.inspections, public.inspection_items, public.inspection_item_photos to anon;
grant select, insert on public.damage_markers to anon;
grant insert on public.damage_marker_photos to anon;
grant select on public.checklist_items, public.vehicle_checklist_items to anon;
grant select on public.vehicle_base_photos, public.damage_marker_base_photos to anon;
grant all on all tables in schema public to service_role;

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

do $$ declare t text;
begin
  for t in select unnest(array['drivers','vehicles','vehicle_sessions','inspections','inspection_items','inspection_item_photos','damage_markers','damage_marker_photos','vehicle_blueprints','vehicle_base_photos','damage_marker_base_photos','vehicle_logbooks','vehicle_repairs'])
  loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;

drop policy if exists admin_all_checklist_items on public.checklist_items;
create policy admin_all_checklist_items on public.checklist_items for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists admin_all_vehicle_checklist on public.vehicle_checklist_items;
create policy admin_all_vehicle_checklist on public.vehicle_checklist_items for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists anon_read_checklist_items on public.checklist_items;
create policy anon_read_checklist_items on public.checklist_items for select to anon using (is_active = true);
drop policy if exists anon_read_vehicle_checklist on public.vehicle_checklist_items;
create policy anon_read_vehicle_checklist on public.vehicle_checklist_items for select to anon using (enabled = true);

drop policy if exists anon_vehicles_read on public.vehicles;
create policy anon_vehicles_read on public.vehicles for select to anon using (true);
drop policy if exists anon_blueprints_read on public.vehicle_blueprints;
create policy anon_blueprints_read on public.vehicle_blueprints for select to anon using (true);
drop policy if exists anon_damage_read on public.damage_markers;
create policy anon_damage_read on public.damage_markers for select to anon using (source = 'baseline' or approved = true);
drop policy if exists anon_damage_insert on public.damage_markers;
create policy anon_damage_insert on public.damage_markers for insert to anon with check (true);
drop policy if exists anon_damage_photo_insert on public.damage_marker_photos;
create policy anon_damage_photo_insert on public.damage_marker_photos for insert to anon with check (true);
drop policy if exists anon_damage_photo_read_approved on public.damage_marker_photos;
create policy anon_damage_photo_read_approved on public.damage_marker_photos for select to anon using (approved = true);
drop policy if exists anon_sessions_select on public.vehicle_sessions;
create policy anon_sessions_select on public.vehicle_sessions for select to anon using (true);
drop policy if exists anon_sessions_insert on public.vehicle_sessions;
create policy anon_sessions_insert on public.vehicle_sessions for insert to anon with check (true);
drop policy if exists anon_inspections_rw on public.inspections;
create policy anon_inspections_rw on public.inspections for all to anon using (true) with check (true);
drop policy if exists anon_inspection_items_rw on public.inspection_items;
create policy anon_inspection_items_rw on public.inspection_items for all to anon using (true) with check (true);
drop policy if exists anon_inspection_photos_rw on public.inspection_item_photos;
create policy anon_inspection_photos_rw on public.inspection_item_photos for all to anon using (true) with check (true);
drop policy if exists anon_base_photos_read on public.vehicle_base_photos;
create policy anon_base_photos_read on public.vehicle_base_photos for select to anon using (true);
drop policy if exists anon_dmbp_read on public.damage_marker_base_photos;
create policy anon_dmbp_read on public.damage_marker_base_photos for select to anon using (true);