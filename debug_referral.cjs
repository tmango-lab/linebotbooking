
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Environment Variables. Make sure .env is present.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const bookingId = '1771410640014';
const dashboardUserId = 'Ua636ab14081b483636896549d2026398';

async function main() {
    console.log('--- Checking Booking ---');
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('booking_id, status, payment_status, user_id, price_total_thb')
        .eq('booking_id', bookingId)
        .maybeSingle();

    if (bookingError) console.error('Booking Error:', bookingError);
    else console.log('Booking Data:', booking);

    console.log('\n--- Checking Referral ---');
    const { data: referral, error: refError } = await supabase
        .from('referrals')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

    if (refError) console.error('Referral Error:', refError);
    else console.log('Referral Data:', referral);

    if (referral) {
        if (referral.referrer_id !== dashboardUserId) {
            console.log(`\n❌ MISMATCH: Referral referrer_id (${referral.referrer_id}) DOES NOT MATCH Dashboard User (${dashboardUserId})`);
        } else {
            console.log(`\n✅ MATCH: Referral is linked to the correct dashboard user.`);
        }
    } else {
        console.log('\n❌ NO REFERRAL RECORD FOUND for this booking.');
        // Check if user used a code?
        const { data: promo } = await supabase.from('promo_codes').select('*').eq('booking_id', bookingId);
        console.log('Promo Codes used:', promo);
    }

    console.log('\n--- Checking Affiliate Stats ---');
    const { data: affiliate, error: affError } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', dashboardUserId)
        .maybeSingle();

    if (affError) console.error('Affiliate Error:', affError);
    else console.log('Affiliate Stats:', affiliate);

    console.log("\n--- Checking Campaigns ---");
    const { data: campaigns, error: campError } = await supabase
        .from('campaigns')
        .select('id, name, status, created_at')
        .eq('name', '🎁 รางวัลแนะนำเพื่อน');

    if (campError) console.error("Campaign Error:", campError);
    else console.log("Campaigns found:", campaigns);
}

main();
