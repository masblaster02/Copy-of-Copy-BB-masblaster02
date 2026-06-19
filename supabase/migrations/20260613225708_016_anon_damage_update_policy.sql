-- Allow anon (driver) to update session_id and reported_during on their own damage markers.
-- This is needed for the pre-trip backfill that links blueprint-reported damage to the session.

DROP POLICY IF EXISTS anon_damage_update ON public.damage_markers;
CREATE POLICY anon_damage_update ON public.damage_markers
  FOR UPDATE TO anon
  USING (source = 'driver')
  WITH CHECK (source = 'driver');
