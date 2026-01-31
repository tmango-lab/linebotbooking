-- Add V2 Refinement Columns to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS min_spend NUMERIC DEFAULT 0, -- Minimum booking price
ADD COLUMN IF NOT EXISTS eligible_days TEXT[] DEFAULT NULL, -- Array of days e.g. ['Mon', 'Fri']
ADD COLUMN IF NOT EXISTS reward_item TEXT DEFAULT NULL, -- Name of free item (if any)
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE; -- True = Show in list, False = Hidden (Secret Code only)

-- Comments
COMMENT ON COLUMN campaigns.min_spend IS 'Minimum booking price required to use this coupon';
COMMENT ON COLUMN campaigns.eligible_days IS 'List of eligible days of week (Mon,Tue,Wed,Thu,Fri,Sat,Sun). NULL = All Days';
COMMENT ON COLUMN campaigns.reward_item IS 'Description of free item if benefit type is Reward';
COMMENT ON COLUMN campaigns.is_public IS 'If true, shows in public coupon list. If false, requires secret code or direct link.';
