-- Add stripe_payment_intent_id column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Create index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_pi ON bookings(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
