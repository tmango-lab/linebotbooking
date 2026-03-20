
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';

    // 1. Check Campaign
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

    // 2. Find any booking with "WINNER" or "winner"
    const { data: winnerBookings } = await supabase
        .from('bookings')
        .select('*')
        .ilike('display_name', '%WINNER%');

    let winnerCoupons = [];
    if (winnerBookings && winnerBookings.length > 0) {
        const userIds = [...new Set(winnerBookings.map(b => b.user_id))];
        const { data } = await supabase
            .from('user_coupons')
            .select('*')
            .in('user_id', userIds)
            .eq('campaign_id', campaignId);
        winnerCoupons = data || [];
    }

    // 3. Recent Cancelled
    const { data: recentCancelled } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(10);

    const results = {
        campaign,
        winnerBookings,
        winnerCoupons,
        recentCancelled
    };

    fs.writeFileSync('scripts/results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to scripts/results.json');
}

check();
