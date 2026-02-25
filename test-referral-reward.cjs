require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('--- Testing Referral Reward Logic ---');
  
  const { data: latestReferral } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  console.log('Latest Referral:', latestReferral);
  
  if (!latestReferral) return;
  
  // Create a brand new test booking
  const testBookingId = 'TEST-' + Date.now();
  console.log('\n--- Creating Test Referral ---');
  
  const { error: insertError } = await supabase
    .from('referrals')
    .insert({
      referrer_id: latestReferral.referrer_id,
      referee_id: latestReferral.referee_id,
      booking_id: testBookingId,
      program_id: latestReferral.program_id,
      status: 'PENDING_PAYMENT',
      reward_amount: 100
    });
    
  if (insertError) {
    console.error('Insert Error:', insertError);
    return;
  }
  
  console.log('\n--- Calling RPC process_referral_reward_sql ---');
  const { data, error } = await supabase.rpc('process_referral_reward_sql', {
    p_booking_id: testBookingId
  });
  
  console.log('RPC Result:', data);
  console.log('RPC Error:', error);
  
  // Cleanup test
  await supabase.from('referrals').delete().eq('booking_id', testBookingId);
}

test();
