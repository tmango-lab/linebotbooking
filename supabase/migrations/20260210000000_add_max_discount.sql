-- Fix #1: Add max_discount column for percentage-based coupons
-- Prevents unbounded discounts (e.g. 50% off on 1200 THB = 600 THB discount)

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS max_discount INT DEFAULT NULL;

COMMENT ON COLUMN campaigns.max_discount IS 'Maximum discount amount in THB for percentage coupons. NULL = no cap.';
