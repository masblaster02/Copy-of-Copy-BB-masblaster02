-- Add companion_audio_enabled column to drivers table for access control
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS companion_audio_enabled boolean NOT NULL DEFAULT false;

-- Create companion_audio_icons table for coordinate-based icon placement
CREATE TABLE IF NOT EXISTS companion_audio_icons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  x_position numeric NOT NULL,
  y_position numeric NOT NULL,
  audio_path text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_order integer NOT NULL DEFAULT 0
);

-- Index for querying by page
CREATE INDEX IF NOT EXISTS idx_companion_audio_icons_page ON companion_audio_icons(page_key);
CREATE INDEX IF NOT EXISTS idx_companion_audio_icons_order ON companion_audio_icons(page_key, display_order);

-- Enable RLS
ALTER TABLE companion_audio_icons ENABLE ROW LEVEL SECURITY;

-- Anon (driver app) can read icons
CREATE POLICY "anon_read_companion_audio_icons" ON companion_audio_icons
  FOR SELECT TO anon USING (true);

-- Authenticated (admin) can manage icons
CREATE POLICY "authenticated_manage_companion_audio_icons" ON companion_audio_icons
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Drop and recreate the existing companion_page_audio table since we're using icons instead
-- But keep it for backwards compatibility - just add comment
COMMENT ON TABLE companion_page_audio IS 'Legacy table - prefer companion_audio_icons for new audio placement';

-- Function to get companion audio icons for a page (callable by anon)
CREATE OR REPLACE FUNCTION get_companion_audio_icons(p_page_key text)
RETURNS TABLE (id uuid, page_key text, x_position numeric, y_position numeric, audio_path text, label text, display_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, page_key, x_position, y_position, audio_path, label, display_order
  FROM companion_audio_icons
  WHERE page_key = p_page_key
  ORDER BY display_order, created_at;
$$;

-- Function to check if driver has companion audio enabled
CREATE OR REPLACE FUNCTION get_driver_companion_access(p_driver_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT companion_audio_enabled FROM drivers WHERE id = p_driver_id;
$$;