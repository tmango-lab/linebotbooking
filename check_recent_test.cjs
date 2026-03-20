require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- Checking Recent Referral ---');
  const { data: refs, error } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (error || !refs) {
    console.log('Error or no referrals:', error || 'None');
    return;
  }
  
  for (const ref of refs) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('payment_status, status, admin_note')
      .eq('booking_id', ref.booking_id)
      .single();
      
    console.log(`Referral ID: ${ref.id}`);
    console.log(`Booking ID: ${ref.booking_id}`);
    console.log(`Referral Status: ${ref.status}`);
    console.log(`Booking Payment Status: ${booking?.payment_status}`);
    console.log(`Booking Status: ${booking?.status}`);
    console.log(`Admin Note: ${booking?.admin_note}`);
    console.log('---');
  }
  process.exit(0);
}

check();
