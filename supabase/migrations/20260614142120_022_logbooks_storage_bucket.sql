INSERT INTO storage.buckets (id, name, public, created_at)
VALUES ('vehicle-logbooks', 'vehicle-logbooks', false, now())
ON CONFLICT (id) DO NOTHING;

CREATE POLICY logbooks_auth_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-logbooks');

CREATE POLICY logbooks_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-logbooks');

CREATE POLICY logbooks_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-logbooks')
  WITH CHECK (bucket_id = 'vehicle-logbooks');

CREATE POLICY logbooks_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-logbooks');
