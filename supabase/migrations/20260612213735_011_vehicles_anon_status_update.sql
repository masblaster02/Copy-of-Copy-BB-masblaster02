-- 011_vehicles_anon_status_update
-- Allow drivers (anon role) to update vehicle status
-- This is needed for pre-trip (available -> assigned) and return (assigned -> available)

create policy "anon_vehicles_status_update" on public.vehicles
  for update to anon
  using (true)
  with check (true);
