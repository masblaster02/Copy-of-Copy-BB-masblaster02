-- Add audio_path column to checklist_items for per-item audio instructions
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS audio_path text;

-- Create companion_page_audio table for page-level audio
CREATE TABLE IF NOT EXISTS companion_page_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text UNIQUE NOT NULL,
  label text NOT NULL,
  audio_path text,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE companion_page_audio ENABLE ROW LEVEL SECURITY;

-- Anon can read (driver app reads these without auth)
CREATE POLICY "anon_read_companion_page_audio" ON companion_page_audio
  FOR SELECT TO anon USING (true);

-- Admin can manage via authenticated role (assumes has_role check elsewhere or use auth.uid exists)
CREATE POLICY "authenticated_manage_companion_page_audio" ON companion_page_audio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed the six page keys
INSERT INTO companion_page_audio (page_key, label) VALUES
  ('driver_login', 'Login Page'),
  ('driver_menu', 'Main Menu'),
  ('driver_select_vehicle', 'Select Vehicle'),
  ('driver_blueprint', 'Vehicle Blueprint'),
  ('driver_pretrip', 'Pre-Trip Inspection'),
  ('driver_return', 'Return Vehicle Inspection')
ON CONFLICT (page_key) DO NOTHING;

-- Create storage bucket for companion audio (public read for anon access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('companion-audio', 'companion-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: anon can read
CREATE POLICY "anon_read_companion_audio" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'companion-audio');

-- Storage policy: authenticated can upload/update/delete
CREATE POLICY "authenticated_write_companion_audio" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'companion-audio')
  WITH CHECK (bucket_id = 'companion-audio');