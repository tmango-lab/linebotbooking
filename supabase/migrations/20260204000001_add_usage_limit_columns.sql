-- Add usage_limit and usage_count columns to manual_promo_codes
ALTER TABLE manual_promo_codes 
ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
