-- Add redemption_limit and redemption_count to campaigns table
-- redemption_limit: Max number of times this campaign/coupon can be successfully used (paid/confirmed). Null means unlimited.
-- redemption_count: Current number of successful usages.

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS redemption_limit INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS redemption_count INTEGER DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN campaigns.redemption_limit IS 'Limit number of successful redemptions (e.g. 5 prizes). Null = Unlimited.';
COMMENT ON COLUMN campaigns.redemption_count IS 'Current number of successful redemptions.';

-- [NEW] RPC function for atomic increment
CREATE OR REPLACE FUNCTION increment_campaign_redemption(campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE campaigns
  SET redemption_count = redemption_count + 1
  WHERE id = campaign_id;
END;
$$;
