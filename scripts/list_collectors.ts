
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listCollectors() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';
    console.log(`🔍 Listing collectors for campaign: ${campaignId}`);

    const { data: campaign } = await supabase
        .from('campaigns')
        .select('name')
        .eq('id', campaignId)
        .single();

    if (campaign) {
        console.log(`✨ Campaign: ${campaign.name}`);
    }

    const { data: coupons, error } = await supabase
        .from('user_coupons')
        .select(`
            user_id,
            status,
            created_at,
            profiles(team_name, phone_number)
        `)
        .eq('campaign_id', campaignId);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    console.log(`📊 Total Collected: ${coupons.length}`);
    console.log('\nList of collectors:');

    const formatted = coupons.map(c => ({
        user_id: c.user_id,
        status: c.status,
        team_name: (c.profiles as any)?.team_name || 'N/A',
        phone_number: (c.profiles as any)?.phone_number || 'N/A',
        collected_at: c.created_at
    }));

    console.table(formatted);
}

listCollectors();
