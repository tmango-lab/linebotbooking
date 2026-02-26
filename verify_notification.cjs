require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  const bookingId = '1772071140218';
  console.log(`--- Verifying Notification for ${bookingId} ---`);
  
  // 1. Reset status to PENDING_PAYMENT
  await supabase.from('referrals').update({ status: 'PENDING_PAYMENT' }).eq('booking_id', bookingId);
  console.log('Reset status to PENDING_PAYMENT');
  
  // 2. Call the function
  const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/process-referral-reward`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ bookingId })
  });
  
  const data = await response.json();
  console.log('Result:', JSON.stringify(data, null, 2));
}

verify();
