-- 013_vehicle_summary_view
-- Read-only view aggregating per-vehicle stats for the admin panel

CREATE OR REPLACE VIEW public.vehicle_summary AS
WITH session_stats AS (
  SELECT
    vehicle_id,
    COUNT(*)           AS total_sessions,
    MAX(started_at)    AS last_used_at,
    SUM(CASE WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) IS NOT NULL
             THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60 ELSE 0 END) AS total_minutes
  FROM public.vehicle_sessions
  GROUP BY vehicle_id
),
damage_stats AS (
  SELECT
    vehicle_id,
    COUNT(*) FILTER (WHERE status = 'open' AND (source = 'baseline' OR approved = true)) AS open_damage_count,
    COUNT(*)                                                                               AS total_damage_count
  FROM public.damage_markers
  GROUP BY vehicle_id
),
latest_inspection AS (
  SELECT DISTINCT ON (vehicle_id)
    vehicle_id,
    created_at          AS last_inspection_at,
    inspection_type     AS last_inspection_type,
    items_issue_count   AS last_inspection_issues
  FROM public.inspections
  ORDER BY vehicle_id, created_at DESC
)
SELECT
  v.id,
  v.registration_number,
  v.make,
  v.model,
  v.year,
  v.status,
  v.archived,
  COALESCE(ss.total_sessions, 0)          AS total_sessions,
  ss.last_used_at,
  COALESCE(ss.total_minutes, 0)           AS total_drive_minutes,
  COALESCE(ds.open_damage_count, 0)       AS open_damage_count,
  COALESCE(ds.total_damage_count, 0)      AS total_damage_count,
  li.last_inspection_at,
  li.last_inspection_type,
  COALESCE(li.last_inspection_issues, 0)  AS last_inspection_issues
FROM public.vehicles v
LEFT JOIN session_stats     ss ON ss.vehicle_id = v.id
LEFT JOIN damage_stats      ds ON ds.vehicle_id = v.id
LEFT JOIN latest_inspection li ON li.vehicle_id = v.id;

-- Grant to authenticated (admins) and anon (not needed but harmless)
GRANT SELECT ON public.vehicle_summary TO authenticated;
