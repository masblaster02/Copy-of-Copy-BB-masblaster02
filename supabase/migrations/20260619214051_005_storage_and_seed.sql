insert into storage.buckets (id, name, public, created_at) values ('vehicle-blueprints', 'vehicle-blueprints', true, now()) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, created_at) values ('vehicle-base-photos', 'vehicle-base-photos', true, now()) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, created_at) values ('inspection-photos', 'inspection-photos', false, now()) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, created_at) values ('damage-photos', 'damage-photos', false, now()) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, created_at) values ('vehicle-logbooks', 'vehicle-logbooks', false, now()) on conflict (id) do nothing;

drop policy if exists bp_public_read on storage.objects;
create policy bp_public_read on storage.objects for select to public using (bucket_id = 'vehicle-blueprints');
drop policy if exists bp_auth_insert on storage.objects;
create policy bp_auth_insert on storage.objects for insert to authenticated with check (bucket_id = 'vehicle-blueprints');
drop policy if exists bp_auth_update on storage.objects;
create policy bp_auth_update on storage.objects for update to authenticated using (bucket_id = 'vehicle-blueprints') with check (bucket_id = 'vehicle-blueprints');
drop policy if exists bp_auth_delete on storage.objects;
create policy bp_auth_delete on storage.objects for delete to authenticated using (bucket_id = 'vehicle-blueprints');

drop policy if exists base_public_read on storage.objects;
create policy base_public_read on storage.objects for select to public using (bucket_id = 'vehicle-base-photos');
drop policy if exists base_auth_insert on storage.objects;
create policy base_auth_insert on storage.objects for insert to authenticated with check (bucket_id = 'vehicle-base-photos');
drop policy if exists base_auth_update on storage.objects;
create policy base_auth_update on storage.objects for update to authenticated using (bucket_id = 'vehicle-base-photos') with check (bucket_id = 'vehicle-base-photos');
drop policy if exists base_auth_delete on storage.objects;
create policy base_auth_delete on storage.objects for delete to authenticated using (bucket_id = 'vehicle-base-photos');

drop policy if exists damage_anon_read on storage.objects;
create policy damage_anon_read on storage.objects for select to anon using (bucket_id = 'damage-photos');
drop policy if exists damage_auth_read on storage.objects;
create policy damage_auth_read on storage.objects for select to authenticated using (bucket_id = 'damage-photos');
drop policy if exists damage_anon_insert on storage.objects;
create policy damage_anon_insert on storage.objects for insert to anon with check (bucket_id = 'damage-photos');
drop policy if exists damage_auth_insert on storage.objects;
create policy damage_auth_insert on storage.objects for insert to authenticated with check (bucket_id = 'damage-photos');
drop policy if exists damage_auth_update on storage.objects;
create policy damage_auth_update on storage.objects for update to authenticated using (bucket_id = 'damage-photos') with check (bucket_id = 'damage-photos');
drop policy if exists damage_auth_delete on storage.objects;
create policy damage_auth_delete on storage.objects for delete to authenticated using (bucket_id = 'damage-photos');

drop policy if exists inspect_anon_read on storage.objects;
create policy inspect_anon_read on storage.objects for select to anon using (bucket_id = 'inspection-photos');
drop policy if exists inspect_auth_read on storage.objects;
create policy inspect_auth_read on storage.objects for select to authenticated using (bucket_id = 'inspection-photos');
drop policy if exists inspect_anon_insert on storage.objects;
create policy inspect_anon_insert on storage.objects for insert to anon with check (bucket_id = 'inspection-photos');
drop policy if exists inspect_auth_insert on storage.objects;
create policy inspect_auth_insert on storage.objects for insert to authenticated with check (bucket_id = 'inspection-photos');
drop policy if exists inspect_auth_update on storage.objects;
create policy inspect_auth_update on storage.objects for update to authenticated using (bucket_id = 'inspection-photos') with check (bucket_id = 'inspection-photos');
drop policy if exists inspect_auth_delete on storage.objects;
create policy inspect_auth_delete on storage.objects for delete to authenticated using (bucket_id = 'inspection-photos');

drop policy if exists logbooks_auth_read on storage.objects;
create policy logbooks_auth_read on storage.objects for select to authenticated using (bucket_id = 'vehicle-logbooks');
drop policy if exists logbooks_auth_insert on storage.objects;
create policy logbooks_auth_insert on storage.objects for insert to authenticated with check (bucket_id = 'vehicle-logbooks');
drop policy if exists logbooks_auth_update on storage.objects;
create policy logbooks_auth_update on storage.objects for update to authenticated using (bucket_id = 'vehicle-logbooks') with check (bucket_id = 'vehicle-logbooks');
drop policy if exists logbooks_auth_delete on storage.objects;
create policy logbooks_auth_delete on storage.objects for delete to authenticated using (bucket_id = 'vehicle-logbooks');

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