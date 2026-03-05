require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetReferral() {
    const userId = 'U503d2128e37c22c055f6bc493a39f2e4';
    console.log(`Resetting referral status for user: ${userId}`);

    // Delete from referrals table to allow them to be referred again
    const { data, error } = await supabase
        .from('referrals')
        .delete()
        .eq('referee_id', userId);

    if (error) {
        console.error('Error deleting referral record:', error.message);
    } else {
        console.log('Successfully deleted referral record for the user.');
    }
}

resetReferral();
