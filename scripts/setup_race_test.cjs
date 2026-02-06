
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupRace() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';
    console.log('--- Setting up Race Condition Test (RACE_A vs RACE_B) ---');

    // 1. Ensure we have exactly 1 slot left
    // (Assuming current count is 1/2 from previous tests)
    const { data: campaign } = await supabase.from('campaigns').select('redemption_count').eq('id', campaignId).single();
    console.log(`Current Redemption Count: ${campaign.redemption_count} / 2`);

    if (campaign.redemption_count !== 1) {
        console.warn('⚠️ Warning: Expected count to be 1. Forcing set to 1 for this test.');
        await supabase.from('campaigns').update({ redemption_count: 1 }).eq('id', campaignId);
    }

    // 2. Create RACE_A and RACE_B coupons and bookings
    const users = ['RACE_A', 'RACE_B'];

    for (const userId of users) {
        // Clear old data
        await supabase.from('user_coupons').delete().eq('user_id', userId);
        await supabase.from('bookings').delete().eq('user_id', userId);

        // Create Coupon
        const { data: coupon } = await supabase.from('user_coupons').insert({
            user_id: userId,
            campaign_id: campaignId,
            status: 'ACTIVE' // Initially active
        }).select().single();

        // Create Pending Booking
        const bookingId = Date.now() + '_' + userId;
        await supabase.from('bookings').insert({
            booking_id: bookingId,
            user_id: userId,
            display_name: userId,
            field_no: 1,
            date: '2026-03-01',
            time_from: '18:00:00',
            time_to: '19:00:00',
            duration_h: 1,
            price_total_thb: 350,
            payment_status: 'pending',
            status: 'pending_payment',
            is_promo: true
        });

        // Link Coupon (Simulate 'USED' / locked state upon booking creation)
        await supabase.from('user_coupons').update({
            status: 'USED',
            booking_id: bookingId,
            used_at: new Date().toISOString()
        }).eq('id', coupon.id);

        console.log(`Created pending booking for ${userId}: ${bookingId}`);
    }

    console.log('--- Setup Complete. Both users ready to "Auto-Verify". ---');
}

setupRace();
