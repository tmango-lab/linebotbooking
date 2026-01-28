-- Add phone_number column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS phone_number TEXT;
