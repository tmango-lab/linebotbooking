const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEligibility(userId) {
    console.log(`Checking eligibility for user: ${userId}`);

    // 1. Check Profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    console.log('Profile:', profile ? 'Found' : 'Not Found');

    // 2. Check Bookings
    const { count, error, data } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: false })
        .eq('user_id', userId)
        .neq('status', 'cancelled');

    if (error) {
        console.error('Booking Check Error:', error);
    } else {
        console.log(`Booking Count: ${count}`);
        console.log('Sample Booking:', data[0]);
    }
}

// Get userId from command line arg
const userId = process.argv[2];
if (!userId) {
    console.log('Usage: node verify_eligibility.cjs <userId>');
} else {
    checkEligibility(userId);
}
