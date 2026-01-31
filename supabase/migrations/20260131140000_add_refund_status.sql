-- Add is_refunded column to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN bookings.is_refunded IS 'Flag to indicate if the booking payment has been refunded to the customer';
