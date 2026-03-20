require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function processMissed() {
  console.log('--- Processing Missed Referrals ---');
  const { data, error } = await supabase
    .from('referrals')
    .select('*, bookings!inner(payment_status, status)')
    .eq('status', 'PENDING_PAYMENT');
    
  if (error) {
    console.error('Error fetching referrals:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No pending referrals found.');
    return;
  }
  
  for (const ref of data) {
    // Check if booking is actually paid
    if (ref.bookings.payment_status === 'paid' || ref.bookings.payment_status === 'deposit_paid') {
      console.log(`Processing booking ${ref.booking_id}...`);
      const { data: resData, error: resErr } = await supabase.rpc('process_referral_reward_sql', {
        p_booking_id: ref.booking_id
      });
      console.log(`Result:`, resData || resErr);
    } else {
      console.log(`Booking ${ref.booking_id} is not paid yet (${ref.bookings.payment_status}). Skipping.`);
    }
  }
}

processMissed();
