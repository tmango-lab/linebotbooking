require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function processMissed() {
  console.log('--- Processing Missed Referrals (No Foreign Key) ---');
  const { data: refs, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('status', 'PENDING_PAYMENT');
    
  if (error || !refs || refs.length === 0) {
    console.log('Error or no pending referrals:', error || 'None');
    return;
  }
  
  for (const ref of refs) {
    // Check booking status separately
    const { data: booking } = await supabase
      .from('bookings')
      .select('payment_status, status')
      .eq('booking_id', ref.booking_id)
      .single();
      
    if (booking && (booking.payment_status === 'paid' || booking.payment_status === 'deposit_paid')) {
      console.log(`Processing booking ${ref.booking_id}...`);
      const { data: resData, error: resErr } = await supabase.rpc('process_referral_reward_sql', {
        p_booking_id: ref.booking_id
      });
      console.log(`Result for ${ref.booking_id}:`, resData || resErr);
    } else {
      console.log(`Booking ${ref.booking_id} status is ${booking?.payment_status}. Skipping.`);
    }
  }
  process.exit(0);
}

processMissed();
