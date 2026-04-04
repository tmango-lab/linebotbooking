-- Fix: เพิ่ม Foreign Key ระหว่าง open_matches.booking_id → bookings.booking_id
-- จำเป็นเพื่อให้ PostgREST สามารถ JOIN ข้อมูลได้ (ไม่งั้นจะขึ้น error "Could not find a relationship")

ALTER TABLE public.open_matches
ADD CONSTRAINT open_matches_booking_fk
FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id);
