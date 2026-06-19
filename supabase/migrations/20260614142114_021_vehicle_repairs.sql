CREATE TABLE vehicle_repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  repair_date date NOT NULL,
  description text NOT NULL,
  cost numeric(10, 2),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_repairs_auth" ON vehicle_repairs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_repairs_auth" ON vehicle_repairs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_repairs_auth" ON vehicle_repairs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_repairs_auth" ON vehicle_repairs
  FOR DELETE TO authenticated USING (true);
