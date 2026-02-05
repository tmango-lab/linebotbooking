-- Add attendance_status column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS attendance_status text CHECK (attendance_status IN ('confirmed', 'cancel_requested'));

COMMENT ON COLUMN bookings.attendance_status IS 'Status of user attendance confirmation (confirmed, cancel_requested)';
