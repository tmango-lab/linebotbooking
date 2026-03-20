-- Fix Bug #2: Change unique index to only block duplicate ACTIVE coupons
-- Previous index blocked all non-CANCELLED statuses, preventing Refillable system
-- New index only blocks duplicate ACTIVE coupons, allowing re-collection after use

DROP INDEX IF EXISTS idx_user_coupons_unique_active;

CREATE UNIQUE INDEX idx_user_coupons_unique_active 
ON user_coupons (user_id, campaign_id) 
WHERE status = 'ACTIVE';
