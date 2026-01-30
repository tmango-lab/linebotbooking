
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TARGET_CODE = '640198';

async function findCode() {
    console.log(`🔍 Searching for code: ${TARGET_CODE}...`);

    // 1. Check Campaigns (secret_code)
    const { data: campaign, error: cError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('secret_code', TARGET_CODE)
        .maybeSingle();

    if (campaign) {
        console.log(`✅ Found in Campaigns!`);
        console.log(campaign);
        return;
    }

    // 2. Check User Coupons (maybe manual code?) - though schema doesn't usually have 'code' on user_coupons unless verification.
    // Let's check if there is a 'code' column in user_coupons just in case.
    // (Based on memory, user_coupons usually joins to campaign).

    console.log("❌ Not found in Campaigns (secret_code). Checking if it matches any pattern...");
}

findCode();
