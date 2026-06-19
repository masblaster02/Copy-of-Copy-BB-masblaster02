-- Add session_id and reported_during to damage_markers if not present

ALTER TABLE public.damage_markers
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.vehicle_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reported_during text CHECK (reported_during IN ('pre_trip', 'return'));

CREATE INDEX IF NOT EXISTS idx_damage_markers_session ON public.damage_markers(session_id);
CREATE INDEX IF NOT EXISTS idx_damage_markers_reported_during ON public.damage_markers(reported_during);

GRANT UPDATE (session_id, reported_during) ON public.damage_markers TO anon;
