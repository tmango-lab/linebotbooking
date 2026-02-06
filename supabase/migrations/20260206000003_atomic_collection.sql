
-- Prevent duplicate active coupons for the same user and campaign
-- This effectively enforces a limit_per_user = 1 at the database level.
-- If we ever need limit > 1, we must remove this index or make it partial.

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coupons_unique_active 
ON user_coupons (user_id, campaign_id) 
WHERE status != 'CANCELLED';
