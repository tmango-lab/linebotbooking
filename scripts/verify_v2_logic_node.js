
import { createClient } from '@supabase/supabase-js';

// Setup Environment Variables
// Note: Run this script with: node --env-file=.env scripts/verify_v2_logic_node.js

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY missing.");
    console.error("👉 Usage: node --env-file=.env scripts/verify_v2_logic_node.js");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const USER_ID = 'TEST_USER_' + Date.now();
const CAMPAIGN_NAME = 'TEST_CAMPAIGN_' + Date.now();

async function runTest() {
    console.log("🚀 Starting V2 Logic Verification (ES Module)...");

    // 1. Create Campaign
    const { data: campaign, error: cError } = await supabase
        .from('campaigns')
        .insert({
            name: CAMPAIGN_NAME,
            coupon_type: 'MAIN',
            benefit_type: 'DISCOUNT',
            benefit_value: { amount: 100 },
            total_quantity: 10,
            remaining_quantity: 10,
            limit_per_user: 1,
            eligible_fields: [1, 2],
            is_public: true, // Allow public collection
            status: 'ACTIVE',
            start_date: new Date(Date.now() - 3600000).toISOString() // 1 Hour ago
        })
        .select()
        .single();

    if (cError) {
        console.error("❌ Failed to create campaign:", cError.message);
        return;
    }
    console.log(`✅ Campaign Created: ${campaign.id}`);

    // 2. Collect Coupon
    console.log("\n📡 Invoking 'collect-coupon'...");
    const { data: collectResult, error: invokeError } = await supabase.functions.invoke('collect-coupon', {
        body: { userId: USER_ID, campaignId: campaign.id }
    });

    if (invokeError) {
        // Try to read the error body from context
        let errorBody = invokeError;
        if (invokeError.context && typeof invokeError.context.json === 'function') {
            try { errorBody = await invokeError.context.json(); } catch (e) { }
        }
        console.error("❌ Collect Failed (Invoke Error):", errorBody);
    } else if (collectResult && collectResult.error) {
        console.error("❌ Collect Failed (Logic Error):", collectResult.error);
    } else {
        console.log("✅ Collect Success");
    }

    // 3. Duplicate Test
    console.log("\n📡 Invoking 'collect-coupon' (Duplicate)...");
    const { data: dupData, error: dupError } = await supabase.functions.invoke('collect-coupon', {
        body: { userId: USER_ID, campaignId: campaign.id }
    });

    let dupErrorBody = null;
    if (dupError) {
        // Try checking context json
        if (dupError.context && typeof dupError.context.json === 'function') {
            try {
                const json = await dupError.context.json();
                dupErrorBody = json.error || json.message;
            } catch (e) {
                dupErrorBody = dupError.message;
            }
        } else {
            dupErrorBody = dupError.message;
        }
    } else if (dupData && dupData.error) {
        dupErrorBody = dupData.error;
    }

    if (dupErrorBody && dupErrorBody.includes('Limit')) {
        console.log("✅ Check Passed: Duplicate prevented correctly (" + dupErrorBody + ")");
    } else {
        console.error("❌ Check Failed: Expected 'Limit reached' error, but got:", dupErrorBody || dupData || "Success (Unexpected)");
    }

    // 4. Cleanup
    console.log("\n🧹 Cleaning up...");
    await supabase.from('user_coupons').delete().eq('user_id', USER_ID);
    await supabase.from('campaigns').delete().eq('id', campaign.id);
    console.log("✅ Cleanup Done.");
}

runTest();
