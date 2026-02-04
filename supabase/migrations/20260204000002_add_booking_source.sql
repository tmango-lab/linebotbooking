-- Add booking_source column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'line';

-- Comment on column
COMMENT ON COLUMN bookings.booking_source IS 'Source of the booking: line, admin, line_bot_regular, etc.';
