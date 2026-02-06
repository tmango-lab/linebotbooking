
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCoupon() {
    const userId = 'TIMEOUT_USER';
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';

    // Get coupon
    const { data: coupon } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('user_id', userId)
        .eq('campaign_id', campaignId)
        .single();

    if (coupon) {
        console.log(`Coupon Status: ${coupon.status}`);
        console.log(`Booking ID: ${coupon.booking_id}`);
        console.log(`Used At: ${coupon.used_at}`);

        if (coupon.status === 'ACTIVE' && !coupon.booking_id) {
            console.log('✅ TEST PASSED: Coupon was released!');
        } else {
            console.log('❌ TEST FAILED: Coupon is still USED or linked.');
        }
    } else {
        console.log('No coupon found for TIMEOUT_USER');
    }
}

checkCoupon();
