-- Run this in Supabase Studio SQL Editor
ALTER TABLE referral_programs ADD COLUMN IF NOT EXISTS allowed_payment_methods text[];
UPDATE referral_programs SET allowed_payment_methods = ARRAY['qr', 'field'] WHERE allowed_payment_methods IS NULL;
