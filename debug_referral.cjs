
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

const BOOKING_ID = '1771468372401'; // User provided ID
const REFERRER_ID = 'Ua636ab14081b483636896549d2026398'; // User provided Referrer ID

async function main() {
    console.log(`\n--- Checking Booking ${BOOKING_ID} ---`);
    const { data: booking, error: bookError } = await supabase
        .from('bookings')
        .select('booking_id, status, payment_status, user_id, price_total_thb')
        .eq('booking_id', BOOKING_ID)
        .single();

    if (bookError) console.error('Booking Error:', bookError);
    else console.log('Booking Data:', booking);

    console.log('\n--- Checking Referral ---');
    const { data: referral, error: refError } = await supabase
        .from('referrals')
        .select('*')
        .eq('booking_id', BOOKING_ID)
        .maybeSingle();

    if (refError) console.error('Referral Error:', refError);
    else if (!referral) console.log('❌ No referral record found for this booking!');
    else console.log('Referral Data:', referral);

    if (referral && referral.referrer_id !== REFERRER_ID) {
        console.log(`⚠️ MISMATCH: Referral is linked to ${referral.referrer_id}, but dashboard user is ${REFERRER_ID}`);
    } else if (referral) {
        console.log('✅ MATCH: Referral is linked to the correct dashboard user.');
    }

    console.log('\n--- Checking Affiliate Stats ---');
    const { data: affiliate, error: affError } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', REFERRER_ID)
        .single();

    if (affError) console.error('Affiliate Error:', affError);
    else console.log('Affiliate Stats:', affiliate);

    // Check if coupon exists
    console.log('\n--- Checking Coupons ---');
    const { data: coupons, error: couponError } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('user_id', REFERRER_ID)
        .order('created_at', { ascending: false })
        .limit(5);

    if (couponError) console.error('Coupon Error:', couponError);
    else console.log('User Coupons (Last 5):', coupons);
}

main();
