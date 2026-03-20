
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';

    const { data: campaign } = await supabase
        .from('campaigns')
        .select('name, redemption_count, redemption_limit')
        .eq('id', campaignId)
        .single();

    console.log('Campaign Status:', JSON.stringify(campaign, null, 2));

    const { data: pending } = await supabase
        .from('bookings')
        .select('booking_id, user_id, display_name, status, created_at')
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false });

    console.log('Pending Bookings:', JSON.stringify(pending, null, 2));
}

check();
