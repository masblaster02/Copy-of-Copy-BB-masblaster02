-- 005_storage_buckets.sql
-- Create storage buckets and access policies for Fleet Guardian.

-- ---- Buckets ----
-- vehicle-blueprints: PUBLIC (drivers need to see blueprint images)
insert into storage.buckets (id, name, public, created_at)
values ('vehicle-blueprints', 'vehicle-blueprints', true, now())
on conflict (id) do nothing;

-- vehicle-base-photos: PUBLIC (drivers need to see reference photos for damage spots)
insert into storage.buckets (id, name, public, created_at)
values ('vehicle-base-photos', 'vehicle-base-photos', true, now())
on conflict (id) do nothing;

-- inspection-photos: PRIVATE (table-level RLS gates visibility)
insert into storage.buckets (id, name, public, created_at)
values ('inspection-photos', 'inspection-photos', false, now())
on conflict (id) do nothing;

-- damage-photos: PRIVATE (table-level RLS gates which photo paths anon can see)
insert into storage.buckets (id, name, public, created_at)
values ('damage-photos', 'damage-photos', false, now())
on conflict (id) do nothing;

-- ---- Storage policies: vehicle-blueprints (public bucket, but explicit) ----
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

-- ---- Storage policies: vehicle-base-photos (public bucket) ----
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

-- ---- Storage policies: damage-photos (private, anon can read approved + insert new) ----
-- Anon needs to read because table-level RLS already gates WHICH paths are visible
-- (only approved damage_marker_photos rows are returned to anon). The UUID-based paths
-- make unapproved photos unguessable even if the bucket were fully readable.
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

-- ---- Storage policies: inspection-photos (private, anon can read + insert) ----
-- Same model: table RLS gates which paths are returned. Drivers upload inspection photos.
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