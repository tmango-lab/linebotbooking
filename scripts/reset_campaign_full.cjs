
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetCampaign() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';
    console.log(`--- Starting Full Reset for Campaign: ${campaignId} ---`);

    // 1. Reset redemption_count to 0
    console.log('1. Resetting campaign redemption_count to 0...');
    const { error: campaignError } = await supabase
        .from('campaigns')
        .update({ redemption_count: 0 })
        .eq('id', campaignId);

    if (campaignError) console.error('Error resetting campaign:', campaignError);

    // 2. Identify and Clean up associated coupons
    console.log('2. Cleaning up associated user_coupons...');
    const { data: coupons } = await supabase
        .from('user_coupons')
        .select('id, booking_id')
        .eq('campaign_id', campaignId);

    if (coupons && coupons.length > 0) {
        const bookingIds = coupons.map(c => c.booking_id).filter(id => id);

        // Delete coupons for this campaign to let users collect them fresh
        const { error: couponDeleteError } = await supabase
            .from('user_coupons')
            .delete()
            .eq('campaign_id', campaignId);

        if (couponDeleteError) console.error('Error deleting coupons:', couponDeleteError);
        else console.log(`Deleted ${coupons.length} coupons.`);

        // 3. Delete associated bookings if they were test bookings (optional but helps clean UI)
        if (bookingIds.length > 0) {
            console.log(`3. Cleaning up ${bookingIds.length} associated test bookings...`);
            const { error: bookingDeleteError } = await supabase
                .from('bookings')
                .delete()
                .in('booking_id', bookingIds);

            if (bookingDeleteError) console.error('Error deleting bookings:', bookingDeleteError);
            else console.log('Associated bookings deleted.');
        }
    } else {
        console.log('No coupons found to clean up.');
    }

    console.log('--- Reset Complete. Ready for fresh testing! ---');
}

resetCampaign();
