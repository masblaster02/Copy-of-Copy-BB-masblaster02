create or replace function public.sync_inspection_counts()
returns trigger language plpgsql as $$
declare v_inspection_id uuid;
begin
  v_inspection_id := coalesce(new.inspection_id, old.inspection_id);
  update public.inspections set
    items_pass_count = (select count(*) from public.inspection_items where inspection_id = v_inspection_id and result = 'pass'),
    items_issue_count = (select count(*) from public.inspection_items where inspection_id = v_inspection_id and result = 'issue')
  where id = v_inspection_id;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_inspection_counts on public.inspection_items;
create trigger trg_sync_inspection_counts
  after insert or update or delete on public.inspection_items
  for each row execute function public.sync_inspection_counts();

create or replace view public.vehicle_summary as
with session_stats as (
  select vehicle_id, count(*) as total_sessions, max(started_at) as last_used_at,
    sum(case when extract(epoch from (ended_at - started_at)) is not null then extract(epoch from (ended_at - started_at)) / 60 else 0 end) as total_minutes
  from public.vehicle_sessions group by vehicle_id
),
damage_stats as (
  select vehicle_id,
    count(*) filter (where status = 'open' and (source = 'baseline' or approved = true)) as open_damage_count,
    count(*) as total_damage_count
  from public.damage_markers group by vehicle_id
),
latest_inspection as (
  select distinct on (vehicle_id) vehicle_id, created_at as last_inspection_at, inspection_type as last_inspection_type, items_issue_count as last_inspection_issues
  from public.inspections order by vehicle_id, created_at desc
)
select v.id, v.registration_number, v.make, v.model, v.year, v.status, v.archived,
  coalesce(ss.total_sessions, 0) as total_sessions, ss.last_used_at,
  coalesce(ss.total_minutes, 0) as total_drive_minutes,
  coalesce(ds.open_damage_count, 0) as open_damage_count,
  coalesce(ds.total_damage_count, 0) as total_damage_count,
  li.last_inspection_at, li.last_inspection_type,
  coalesce(li.last_inspection_issues, 0) as last_inspection_issues
from public.vehicles v
left join session_stats ss on ss.vehicle_id = v.id
left join damage_stats ds on ds.vehicle_id = v.id
left join latest_inspection li on li.vehicle_id = v.id;

grant select on public.vehicle_summary to authenticated;