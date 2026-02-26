require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const bookingId = '1772071929600';
  console.log(`--- Verifying Admin Action for Booking: ${bookingId} ---`);
  
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('admin_note, payment_status, status')
    .eq('booking_id', bookingId)
    .single();
    
  if (error) {
    console.log('Error fetching booking:', error.message);
    return;
  }
  
  console.log('Payment Status:', booking.payment_status);
  console.log('Status:', booking.status);
  console.log('Admin Note:', booking.admin_note);
  
  const { data: latestRef } = await supabase
    .from('referrals')
    .select('*')
    .eq('booking_id', bookingId)
    .single();
    
  console.log('Referral Status:', latestRef?.status);
}

check();
