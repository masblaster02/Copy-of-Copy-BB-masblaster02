-- 006_damage_approval_enhancements.sql
-- Adds rejection tracking and source column indexing for approval workflow

-- Add rejection reason for declined damage reports
alter table public.damage_markers
  add column if not exists rejection_reason text;

-- Add source column if missing (for distinguishing baseline vs driver-reported)
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'damage_markers' and column_name = 'source') then
    alter table public.damage_markers add column source text not null default 'driver';
    -- Backfill: existing markers without baseline relationship are driver-reported
    update public.damage_markers set source = 'baseline' where source = 'driver' and exists (
      select 1 from damage_marker_base_photos where damage_marker_id = damage_markers.id
    );
  end if;
end $$;

-- Index for approval queue queries
create index if not exists idx_damages_pending_approval on public.damage_markers(source, approved, status) 
  where source = 'driver' and approved = false;

-- Index for admin list queries
create index if not exists idx_damages_admin_list on public.damage_markers(reported_at desc);

-- Index for photos lookup
create index if not exists idx_damage_photos_marker on public.damage_marker_photos(damage_marker_id);

-- Add comment for admin UI
comment on column public.damage_markers.source is 'baseline = known/pre-existing damage, driver = newly reported by driver';
comment on column public.damage_markers.approved is 'For driver-reported damages: true after admin review';
comment on column public.damage_markers.rejection_reason is 'Reason if damage report was rejected';