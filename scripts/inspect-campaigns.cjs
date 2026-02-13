
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCampaigns() {
    console.log('--- Inspecting Campaigns Table Schema ---');

    const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Campaign Keys:', Object.keys(data[0]));
        console.log('Sample Row:', data[0]);
    } else {
        console.log('No campaigns found.');
    }
}

inspectCampaigns();
