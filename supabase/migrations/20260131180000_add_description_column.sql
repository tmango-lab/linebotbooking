-- Add missing description column to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN campaigns.description IS 'Campaign description shown to users';
