-- Drop old constraint if exists
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_coupon_type_check;

-- Add new constraint with correct values (lowercase to match what CampaignModal sends)
ALTER TABLE campaigns
ADD CONSTRAINT campaigns_coupon_type_check 
CHECK (coupon_type IN ('main', 'ontop', 'MAIN', 'ONTOP'));

-- Also ensure the column has a proper default
ALTER TABLE campaigns 
ALTER COLUMN coupon_type SET DEFAULT 'main';
