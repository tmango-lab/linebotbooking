
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BOOKING_ID = '1771468372401';

async function main() {
    console.log(`Testing RPC process_referral_reward_sql for booking ${BOOKING_ID}...`);

    const { data, error } = await supabase.rpc('process_referral_reward_sql', {
        p_booking_id: BOOKING_ID
    });

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('RPC Success:', data);
    }
}

main();
