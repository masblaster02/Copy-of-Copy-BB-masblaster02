-- 012_inspection_counts
-- Add denormalised pass/issue counts to inspections for fast list queries

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS items_pass_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_issue_count integer NOT NULL DEFAULT 0;

-- Backfill existing rows
UPDATE public.inspections i SET
  items_pass_count  = (SELECT COUNT(*) FROM public.inspection_items ii WHERE ii.inspection_id = i.id AND ii.result = 'pass'),
  items_issue_count = (SELECT COUNT(*) FROM public.inspection_items ii WHERE ii.inspection_id = i.id AND ii.result = 'issue');

-- Trigger to keep counts in sync after items are written
CREATE OR REPLACE FUNCTION public.sync_inspection_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.inspections SET
    items_pass_count  = (SELECT COUNT(*) FROM public.inspection_items WHERE inspection_id = NEW.inspection_id AND result = 'pass'),
    items_issue_count = (SELECT COUNT(*) FROM public.inspection_items WHERE inspection_id = NEW.inspection_id AND result = 'issue')
  WHERE id = NEW.inspection_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inspection_counts ON public.inspection_items;
CREATE TRIGGER trg_sync_inspection_counts
AFTER INSERT OR UPDATE ON public.inspection_items
FOR EACH ROW EXECUTE FUNCTION public.sync_inspection_counts();
