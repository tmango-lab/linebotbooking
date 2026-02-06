
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkM4() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';
    const userId = 'M4';

    console.log(`--- Checking Status for M4 ---`);

    // 1. Get recent booking for M4
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

    // 2. Get coupon for M4
    const { data: coupons } = await supabase
        .from('user_coupons')
        .select('*, campaigns(*)')
        .eq('user_id', userId)
        .eq('campaign_id', campaignId);

    const booking = bookings?.[0];
    const coupon = coupons?.[0];

    console.log('Booking Info:');
    if (booking) {
        console.log(`- ID: ${booking.booking_id} | Status: ${booking.status} | Payment: ${booking.payment_status}`);
    } else {
        console.log('- No booking found for M4');
    }

    console.log('\nCoupon Info:');
    if (coupon) {
        console.log(`- Status: ${coupon.status} | Linked Booking ID: ${coupon.booking_id}`);
    } else {
        console.log('- No coupon found for M4');
    }

    // 3. Campaign Status
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('redemption_count, redemption_limit')
        .eq('id', campaignId)
        .single();

    console.log(`\nCampaign Redemption: ${campaign.redemption_count} / ${campaign.redemption_limit}`);
}

checkM4();
