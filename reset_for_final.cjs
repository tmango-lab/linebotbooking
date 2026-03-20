require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function reset() {
  const bookingId = '1772071929600';
  console.log(`--- Resetting ${bookingId} for Final Automated Test ---`);
  
  // 1. Reset referral status
  await supabase.from('referrals').update({ status: 'PENDING_PAYMENT' }).eq('booking_id', bookingId);
  
  // 2. Clear debug logs from admin_note
  const { data: booking } = await supabase.from('bookings').select('admin_note').eq('booking_id', bookingId).single();
  const cleanedNote = (booking?.admin_note || '')
    .replace(/\[RefCheck:.*?\]/g, '')
    .replace(/\| \[Trigger Res:.*?\]/g, '')
    .trim();
  
  await supabase.from('bookings').update({ admin_note: cleanedNote }).eq('booking_id', bookingId);
  
  console.log('Reset complete. Ready for Admin to click Paid.');
}

reset();
