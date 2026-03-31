-- Add ICP (Ideal Customer Profile) fields to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS icp_description text,
  ADD COLUMN IF NOT EXISTS icp_industry text,
  ADD COLUMN IF NOT EXISTS icp_keywords text;

-- Make branding fields optional (simplified onboarding)
ALTER TABLE public.campaigns
  ALTER COLUMN brand_name DROP NOT NULL,
  ALTER COLUMN brand_company DROP NOT NULL,
  ALTER COLUMN brand_email DROP NOT NULL,
  ALTER COLUMN brand_color_primary SET DEFAULT '#6366f1',
  ALTER COLUMN brand_color_dark SET DEFAULT '#1e1b4b';
