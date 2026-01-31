-- Add all missing columns to campaigns table that are used by CampaignModal
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_stackable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS coupon_type TEXT DEFAULT 'main',
ADD COLUMN IF NOT EXISTS valid_time_start TIME,
ADD COLUMN IF NOT EXISTS valid_time_end TIME;

-- Add comments
COMMENT ON COLUMN campaigns.discount_amount IS 'Fixed discount amount in THB';
COMMENT ON COLUMN campaigns.discount_percent IS 'Percentage discount (0-100)';
COMMENT ON COLUMN campaigns.is_stackable IS 'Whether this coupon can be stacked with others';
COMMENT ON COLUMN campaigns.coupon_type IS 'Type of coupon: main or ontop';
COMMENT ON COLUMN campaigns.valid_time_start IS 'Start time for coupon validity (HH:MM)';
COMMENT ON COLUMN campaigns.valid_time_end IS 'End time for coupon validity (HH:MM)';
