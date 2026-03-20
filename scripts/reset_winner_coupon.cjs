
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reset() {
    const userId = 'WINNER';
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';

    console.log(`Resetting coupon for user ${userId} and campaign ${campaignId}...`);

    const { data, error } = await supabase
        .from('user_coupons')
        .update({
            status: 'ACTIVE',
            used_at: null,
            booking_id: null
        })
        .eq('user_id', userId)
        .eq('campaign_id', campaignId);

    if (error) {
        console.error('Error resetting coupon:', error);
    } else {
        console.log('Coupon reset successfully!');
    }
}

reset();
