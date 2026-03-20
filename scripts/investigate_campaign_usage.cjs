
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';

    // 1. Get Campaign Count
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('name, redemption_count, redemption_limit')
        .eq('id', campaignId)
        .single();

    console.log('Campaign State:', campaign);

    // 2. Get USED coupons and their associated information
    const { data: usedCoupons, error } = await supabase
        .from('user_coupons')
        .select(`
            id,
            user_id,
            status,
            booking_id,
            used_at,
            created_at
        `)
        .eq('campaign_id', campaignId)
        .eq('status', 'USED');

    if (error) {
        console.error('Error fetching used coupons:', error);
        return;
    }

    // 3. For each coupon, try to find the display name from the booking if linked
    const detailedResults = [];
    for (const coupon of usedCoupons) {
        let displayName = 'Unknown';
        if (coupon.booking_id) {
            const { data: booking } = await supabase
                .from('bookings')
                .select('display_name, status')
                .eq('booking_id', coupon.booking_id)
                .maybeSingle();

            if (booking) {
                displayName = `${booking.display_name} (Booking Status: ${booking.status})`;
            } else {
                displayName = `Booking ID ${coupon.booking_id} NOT FOUND in DB`;
            }
        } else {
            displayName = `Manual / No Booking Linked (User ID: ${coupon.user_id})`;
        }

        detailedResults.push({
            coupon_id: coupon.id,
            user_id: coupon.user_id,
            display_name: displayName,
            used_at: coupon.used_at,
            booking_id: coupon.booking_id
        });
    }

    const output = {
        campaign,
        used_coupons_count: usedCoupons.length,
        details: detailedResults
    };

    fs.writeFileSync('scripts/investigation_results.json', JSON.stringify(output, null, 2));
    console.log('Results saved to scripts/investigation_results.json');
}

investigate();
