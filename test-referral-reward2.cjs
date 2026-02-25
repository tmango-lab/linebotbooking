require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('--- Calling RPC process_referral_reward_sql ---');
  const { data, error } = await supabase.rpc('process_referral_reward_sql', {
    p_booking_id: '1772011855131'
  });
  
  console.log('RPC Result:', data);
  console.log('RPC Error:', error);
}

test();
