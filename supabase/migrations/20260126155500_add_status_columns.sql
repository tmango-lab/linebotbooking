-- Add source and is_promo columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin', -- 'line', 'admin', 'import'
ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Comment on columns
COMMENT ON COLUMN public.bookings.source IS 'Source of the booking: line, admin, or import';
COMMENT ON COLUMN public.bookings.is_promo IS 'Whether the booking used a promo code';
