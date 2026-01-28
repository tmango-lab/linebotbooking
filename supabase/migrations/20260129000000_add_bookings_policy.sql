-- Enable full access to bookings table for all operations
-- This allows Edge Functions with Service Role Key to manage bookings

CREATE POLICY "Enable all operations for service role" 
ON public.bookings 
FOR ALL 
USING (true) 
WITH CHECK (true);
