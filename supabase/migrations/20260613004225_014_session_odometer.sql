-- 014_session_odometer
-- Add optional odometer fields to vehicle_sessions for mileage tracking

ALTER TABLE public.vehicle_sessions
  ADD COLUMN IF NOT EXISTS odometer_start numeric,
  ADD COLUMN IF NOT EXISTS odometer_end   numeric;

COMMENT ON COLUMN public.vehicle_sessions.odometer_start IS 'Optional odometer reading at session start (km)';
COMMENT ON COLUMN public.vehicle_sessions.odometer_end   IS 'Optional odometer reading at session end (km)';
