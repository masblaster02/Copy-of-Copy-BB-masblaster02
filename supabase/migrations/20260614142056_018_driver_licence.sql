ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS licence_number text,
  ADD COLUMN IF NOT EXISTS licence_type text CHECK (licence_type IN ('local', 'international')),
  ADD COLUMN IF NOT EXISTS licence_category text,
  ADD COLUMN IF NOT EXISTS cpc_valid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpc_expiry_date date;
