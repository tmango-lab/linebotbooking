require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- Checking Final Test Result ---');
  const { data: latestRef, error } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error || !latestRef) {
    console.log('No referral found.');
    return;
  }
  
  const { data: booking } = await supabase
    .from('bookings')
    .select('payment_status, status')
    .eq('booking_id', latestRef.booking_id)
    .single();
    
  console.log(`Referral ID: ${latestRef.id}`);
  console.log(`Booking ID: ${latestRef.booking_id}`);
  console.log(`Referral Status: ${latestRef.status}`);
  console.log(`Booking Payment Status: ${booking?.payment_status}`);
  console.log(`Booking Status: ${booking?.status}`);
  
  if (latestRef.status === 'COMPLETED') {
    // Check if coupon exists
    const { count: couponCount } = await supabase
      .from('user_coupons')
      .select('id', { count: 'exact' })
      .eq('user_id', latestRef.referrer_id)
      .eq('status', 'ACTIVE');
      
    console.log(`Referrer active coupons: ${couponCount}`);
  }
}

check();
