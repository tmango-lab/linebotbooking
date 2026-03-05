require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepResetReferral() {
    const userId = 'U503d2128e37c22c055f6bc493a39f2e4';
    console.log(`Deep resetting history for user: ${userId}`);

    // 1. Delete from referrals table
    const { error: refError } = await supabase
        .from('referrals')
        .delete()
        .eq('referee_id', userId);

    if (refError) console.error('Error deleting referral record:', refError.message);
    else console.log('✅ Cleared referrals record');

    // 2. Delete all their bookings to pretend they are completely new (or at least recent ones using the promo)
    const { error: bookingError } = await supabase
        .from('bookings')
        .delete()
        .eq('user_id', userId);

    if (bookingError) console.error('Error deleting bookings:', bookingError.message);
    else console.log('✅ Cleared bookings record');

    console.log('Deep reset complete.');
}

deepResetReferral();
