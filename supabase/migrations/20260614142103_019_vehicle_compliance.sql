ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS road_licence_date date,
  ADD COLUMN IF NOT EXISTS road_licence_due date,
  ADD COLUMN IF NOT EXISTS last_service_date date,
  ADD COLUMN IF NOT EXISTS service_due_date date;
