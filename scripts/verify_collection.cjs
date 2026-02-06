
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCollection() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';

    // Check all coupons for this campaign
    const { data: coupons, error } = await supabase
        .from('user_coupons')
        .select('user_id, status, created_at')
        .eq('campaign_id', campaignId);

    if (error) {
        console.error('Error fetching coupons:', error);
        return;
    }

    console.log(`--- Campaign Collection Status ---`);
    console.log(`Total Coupons Collected: ${coupons.length}`);
    coupons.forEach(c => {
        console.log(`- User: ${c.user_id} | Status: ${c.status} | Collected At: ${c.created_at}`);
    });
}

verifyCollection();
