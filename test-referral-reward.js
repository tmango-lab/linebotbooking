const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('--- Testing Referral Reward Logic ---');
  
  // 1. Find a pending referral or latest referral to investigate
  const { data: latestReferral } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  console.log('Latest Referral:', latestReferral);
  
  if (!latestReferral) {
    console.log('No referrals found.');
    return;
  }
  
  // 2. Try to call the RPC directly with a test ID
  console.log('\n--- Calling RPC directly ---');
  const { data, error } = await supabase.rpc('process_referral_reward_sql', {
    p_booking_id: latestReferral.booking_id
  });
  
  console.log('RPC Result:', data);
  console.log('RPC Error:', error);
}

test();
