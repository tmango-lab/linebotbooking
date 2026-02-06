
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';
    const userIds = ['WINNER', 'LOSER'];

    console.log(`--- Checking Status for Users: ${userIds.join(', ')} ---`);

    // 1. Get recent bookings for these users
    const { data: bookings, error: bError } = await supabase
        .from('bookings')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(10);

    if (bError) {
        console.error('Error fetching bookings:', bError);
        return;
    }

    // 2. Get coupons for these users and campaign
    const { data: coupons, error: cError } = await supabase
        .from('user_coupons')
        .select('*, campaigns(*)')
        .in('user_id', userIds)
        .eq('campaign_id', campaignId);

    if (cError) {
        console.error('Error fetching coupons:', cError);
        return;
    }

    const results = {
        bookings: bookings || [],
        coupons: coupons || []
    };

    fs.writeFileSync('scripts/check_pending_status_results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to scripts/check_pending_status_results.json');

    // Quick Console Log summary
    console.log('\nSummary:');
    userIds.forEach(uid => {
        const userBookings = results.bookings.filter(b => b.user_id === uid);
        const userCoupon = results.coupons.find(c => c.user_id === uid);

        console.log(`User: ${uid}`);
        if (userBookings.length > 0) {
            console.log(`  - Latest Booking: ${userBookings[0].booking_id} | Status: ${userBookings[0].status} | Payment: ${userBookings[0].payment_status}`);
        } else {
            console.log(`  - No bookings found.`);
        }

        if (userCoupon) {
            console.log(`  - Coupon Status: ${userCoupon.status} | Linked Booking ID: ${userCoupon.booking_id}`);
        } else {
            console.log(`  - No coupon found for this campaign.`);
        }
    });
}

checkStatus();
