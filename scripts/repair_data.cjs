
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function repair() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';
    const correctBookingId = '1770351425246';
    const wrongBookingId = '1770347334775';

    console.log('--- Repairing Data ---');

    // 1. Fix WINNER's coupon mapping
    const { error: couponError } = await supabase
        .from('user_coupons')
        .update({ booking_id: correctBookingId })
        .eq('user_id', 'WINNER')
        .eq('booking_id', wrongBookingId);

    if (couponError) console.error('Error fixing coupon:', couponError);
    else console.log('Fixed WINNER\'s coupon to point to correct booking.');

    // 2. Manually decrement campaign count
    console.log('Manually decrementing campaign count to 1/2...');
    const { error: incError } = await supabase.rpc('decrement_campaign_redemption', {
        target_campaign_id: campaignId
    });

    if (incError) console.error('Error decrementing:', incError.message);
    else console.log('Campaign count decremented successfully!');

    // 3. Check final state
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('redemption_count')
        .eq('id', campaignId)
        .single();

    console.log(`Final Campaign Count: ${campaign.redemption_count} / 2`);
}

repair();
