
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTimeout() {
    const userId = 'TIMEOUT_USER';

    // 1. Get Booking
    const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (booking) {
        console.log(`Booking ID: ${booking.booking_id}`);
        console.log(`Status: ${booking.status}`);
        console.log(`Timeout At: ${booking.timeout_at}`);
        console.log(`Now (Local): ${new Date().toISOString()}`);

        // Force update to 2 hours ago just to be sure
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        console.log(`Updating timeout_at to: ${twoHoursAgo}`);

        await supabase
            .from('bookings')
            .update({ timeout_at: twoHoursAgo })
            .eq('booking_id', booking.booking_id);

        console.log('Update complete.');
    } else {
        console.log('No booking found for TIMEOUT_USER');
    }
}

checkTimeout();
