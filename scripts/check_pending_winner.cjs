
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const userId = 'WINNER';

    // Find latest pending_payment booking
    const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching booking:', error);
    } else if (booking) {
        console.log('Found Pending Booking for WINNER:', JSON.stringify(booking, null, 2));
    } else {
        console.log('No pending_payment booking found for user WINNER.');
    }
}

check();
