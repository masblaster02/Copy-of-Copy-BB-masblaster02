-- Drop and recreate get_vehicle_enabled_checklist to include audio_path
DROP FUNCTION IF EXISTS get_vehicle_enabled_checklist(uuid, text);

CREATE FUNCTION get_vehicle_enabled_checklist(p_vehicle_id uuid, p_type text DEFAULT 'pre_trip')
RETURNS TABLE (item_id uuid, item_text text, item_order integer, item_key text, audio_path text)
LANGUAGE sql STABLE
AS $$
select ci.id, ci.item_text, ci.item_order, ci.item_key, ci.audio_path
from checklist_items ci
where ci.is_active = true and ci.checklist_type = p_type
and (
not exists (select 1 from vehicle_checklist_items where vehicle_id = p_vehicle_id)
or exists (select 1 from vehicle_checklist_items vci where vci.vehicle_id = p_vehicle_id and vci.checklist_item_id = ci.id and vci.enabled = true)
or not exists (select 1 from vehicle_checklist_items vci where vci.vehicle_id = p_vehicle_id and vci.checklist_item_id = ci.id)
)
order by ci.item_order;
$$;