require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('--- Find all pending referrals ---');
  const { data, error } = await supabase
    .from('referrals')
    .select('*, bookings(payment_status, status)')
    .eq('status', 'PENDING_PAYMENT')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log('Pending Referrals with Booking Status:');
  console.log(JSON.stringify(data, null, 2));
}

test();
