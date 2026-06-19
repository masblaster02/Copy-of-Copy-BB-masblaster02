-- Backfill: approve photos for all already-approved damage markers
UPDATE public.damage_marker_photos
SET
  approved     = true,
  approved_at  = now()
WHERE
  approved = false
  AND damage_marker_id IN (
    SELECT id FROM public.damage_markers WHERE approved = true
  );
