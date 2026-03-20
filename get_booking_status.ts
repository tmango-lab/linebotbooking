import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_id, user_id, status, payment_status, paid_at')
    .eq('booking_id', '1772869027806')
    .single();

  console.log('Booking:', booking);
  console.log('Error:', error);
}

main();
