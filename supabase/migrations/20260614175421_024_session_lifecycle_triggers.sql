-- 024_session_lifecycle_triggers
-- Remove all direct anon UPDATE access on vehicles, vehicle_sessions, and damage_markers.
-- Vehicle status and session lifecycle are now managed by database triggers.
-- Two security-definer RPCs are provided for drivers to start and complete sessions.

-- ================================================================
-- 1. TRIGGER: auto-manage vehicle status from session lifecycle
-- ================================================================

CREATE OR REPLACE FUNCTION public.trg_session_manage_vehicle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      -- Close any other active session for this driver (stale session cleanup)
      UPDATE public.vehicle_sessions
        SET status = 'completed', ended_at = now()
        WHERE driver_id = NEW.driver_id
          AND status = 'active'
          AND id <> NEW.id;
      -- Set vehicle to assigned
      UPDATE public.vehicles SET status = 'assigned' WHERE id = NEW.vehicle_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
      UPDATE public.vehicles SET status = 'available' WHERE id = NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_manage_vehicle ON public.vehicle_sessions;
CREATE TRIGGER trg_session_manage_vehicle
  AFTER INSERT OR UPDATE ON public.vehicle_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_session_manage_vehicle();

-- ================================================================
-- 2. RPC: start_vehicle_session
--    Creates a new active session for a driver + vehicle.
--    Backfills session_id / reported_during on pre-trip damage markers.
--    Returns the new session id.
-- ================================================================

CREATE OR REPLACE FUNCTION public.start_vehicle_session(
  p_driver_id  uuid,
  p_vehicle_id uuid,
  p_marker_ids uuid[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = p_driver_id AND active = true) THEN
    RAISE EXCEPTION 'Driver not found or inactive';
  END IF;

  -- Trigger auto-closes stale sessions and sets vehicle to 'assigned'
  INSERT INTO public.vehicle_sessions (driver_id, vehicle_id, status)
  VALUES (p_driver_id, p_vehicle_id, 'active')
  RETURNING id INTO v_session_id;

  IF array_length(p_marker_ids, 1) IS NOT NULL THEN
    UPDATE public.damage_markers
      SET session_id = v_session_id, reported_during = 'pre_trip'
      WHERE id = ANY(p_marker_ids)
        AND source = 'driver';
  END IF;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_vehicle_session(uuid, uuid, uuid[]) TO anon;

-- ================================================================
-- 3. RPC: complete_vehicle_session
--    Marks a session as completed; trigger sets vehicle to 'available'.
-- ================================================================

CREATE OR REPLACE FUNCTION public.complete_vehicle_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicle_sessions WHERE id = p_session_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Session not found or already completed';
  END IF;

  UPDATE public.vehicle_sessions
    SET status = 'completed', ended_at = now()
    WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_vehicle_session(uuid) TO anon;

-- ================================================================
-- 4. Remove anon UPDATE policies replaced by triggers/RPCs
-- ================================================================

DROP POLICY IF EXISTS "anon_vehicles_status_update" ON public.vehicles;
DROP POLICY IF EXISTS anon_damage_update ON public.damage_markers;

-- Replace anon_session_rw (FOR ALL including UPDATE) with SELECT + INSERT only
DROP POLICY IF EXISTS anon_session_rw ON public.vehicle_sessions;
CREATE POLICY anon_sessions_select ON public.vehicle_sessions
  FOR SELECT TO anon USING (true);
CREATE POLICY anon_sessions_insert ON public.vehicle_sessions
  FOR INSERT TO anon WITH CHECK (true);

-- Revoke UPDATE privileges from anon
REVOKE UPDATE ON public.vehicles FROM anon;
REVOKE UPDATE ON public.vehicle_sessions FROM anon;
REVOKE UPDATE ON public.damage_markers FROM anon;

-- ================================================================
-- 5. Harden damage_markers anon read: approved + baseline only
-- ================================================================

DROP POLICY IF EXISTS anon_damage_read ON public.damage_markers;
CREATE POLICY anon_damage_read ON public.damage_markers
  FOR SELECT TO anon
  USING (source = 'baseline' OR approved = true);

-- ================================================================
-- 6. Fix logbooks + repairs RLS to require admin role
-- ================================================================

DROP POLICY IF EXISTS "select_logbooks_auth" ON public.vehicle_logbooks;
DROP POLICY IF EXISTS "insert_logbooks_auth" ON public.vehicle_logbooks;
DROP POLICY IF EXISTS "update_logbooks_auth" ON public.vehicle_logbooks;
DROP POLICY IF EXISTS "delete_logbooks_auth" ON public.vehicle_logbooks;

CREATE POLICY "select_logbooks_admin" ON public.vehicle_logbooks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_logbooks_admin" ON public.vehicle_logbooks
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_logbooks_admin" ON public.vehicle_logbooks
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_logbooks_admin" ON public.vehicle_logbooks
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "select_repairs_auth" ON public.vehicle_repairs;
DROP POLICY IF EXISTS "insert_repairs_auth" ON public.vehicle_repairs;
DROP POLICY IF EXISTS "update_repairs_auth" ON public.vehicle_repairs;
DROP POLICY IF EXISTS "delete_repairs_auth" ON public.vehicle_repairs;

CREATE POLICY "select_repairs_admin" ON public.vehicle_repairs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_repairs_admin" ON public.vehicle_repairs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_repairs_admin" ON public.vehicle_repairs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_repairs_admin" ON public.vehicle_repairs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ================================================================
-- 7. Fix inspection count trigger to handle DELETE
-- ================================================================

CREATE OR REPLACE FUNCTION public.sync_inspection_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_inspection_id uuid;
BEGIN
  v_inspection_id := COALESCE(NEW.inspection_id, OLD.inspection_id);
  UPDATE public.inspections SET
    items_pass_count  = (SELECT COUNT(*) FROM public.inspection_items WHERE inspection_id = v_inspection_id AND result = 'pass'),
    items_issue_count = (SELECT COUNT(*) FROM public.inspection_items WHERE inspection_id = v_inspection_id AND result = 'issue')
  WHERE id = v_inspection_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inspection_counts ON public.inspection_items;
CREATE TRIGGER trg_sync_inspection_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.inspection_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_inspection_counts();

-- ================================================================
-- 8. Add missing indexes
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_damage_markers_vehicle     ON public.damage_markers(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_damage_markers_driver      ON public.damage_markers(driver_id);
CREATE INDEX IF NOT EXISTS idx_inspection_items_inspection ON public.inspection_items(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_item_photos_item ON public.inspection_item_photos(inspection_item_id);
CREATE INDEX IF NOT EXISTS idx_base_photos_vehicle         ON public.vehicle_base_photos(vehicle_id);
