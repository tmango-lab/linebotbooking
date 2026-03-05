-- Add referral terms consent columns
ALTER TABLE referral_programs ADD COLUMN IF NOT EXISTS require_term_consent BOOLEAN DEFAULT false;
ALTER TABLE referral_programs ADD COLUMN IF NOT EXISTS term_consent_message TEXT;

-- Add booking consent evidence column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agreed_to_referral_terms BOOLEAN DEFAULT false;
