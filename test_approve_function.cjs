require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testApprove() {
  const userId = 'Ua636ab14081b483636896549d2026398'; // นาย ก
  console.log(`--- Testing Approve Affiliate for ${userId} ---`);

  // Reset to PENDING first
  await supabase.from('affiliates').update({ status: 'PENDING' }).eq('user_id', userId);
  console.log('Status reset to PENDING');

  // Call Edge Function
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/approve-affiliate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      userId,
      action: 'APPROVED'
    })
  });

  const data = await response.json();
  console.log('Status Code:', response.status);
  console.log('Response Body:', JSON.stringify(data, null, 2));

  // Check DB Status
  const { data: aff } = await supabase.from('affiliates').select('status').eq('user_id', userId).single();
  console.log(`Final DB Status: ${aff?.status}`);
}

testApprove();
