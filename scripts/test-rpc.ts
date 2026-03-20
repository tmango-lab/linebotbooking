
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
// Use Service Role to allow executing admin RPCs if needed
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRpc() {
    console.log('Testing check_campaign_limit...');
    // Use a known campaign ID or just any UUID since logic is simple
    const CAMPAIGN_ID = '7aa67af1-199c-41eb-96d4-12a5c36b116b';

    const { data, error } = await supabase.rpc('check_campaign_limit', {
        p_campaign_id: CAMPAIGN_ID,
        p_limit: 100
    });

    if (error) {
        console.error('❌ RPC Failed:', error.message);
    } else {
        console.log('✅ RPC Success. Result:', data);
    }
}

testRpc();
