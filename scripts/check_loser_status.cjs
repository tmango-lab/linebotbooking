
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

    // 2. Check LOSER's bookings
    const { data: loserBookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('display_name', 'LOSER')
        .order('created_at', { ascending: false });

    const results = {
        campaign,
        loserBookings: loserBookings || []
    };

    fs.writeFileSync('scripts/loser_test_results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to scripts/loser_test_results.json');
}

check();
