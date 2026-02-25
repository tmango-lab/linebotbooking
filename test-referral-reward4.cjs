require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('--- Find completed referrals ---');
  const { data, error } = await supabase
    .from('referrals')
    .select('id, referee_id, referrer_id, booking_id, status, reward_amount, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Latest Referrals:');
  console.log(JSON.stringify(data, null, 2));
}

test();
