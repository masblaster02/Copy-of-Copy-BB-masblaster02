CREATE TABLE vehicle_logbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_logbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_logbooks_auth" ON vehicle_logbooks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_logbooks_auth" ON vehicle_logbooks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_logbooks_auth" ON vehicle_logbooks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_logbooks_auth" ON vehicle_logbooks
  FOR DELETE TO authenticated USING (true);
