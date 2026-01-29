
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Test Data
const USER_ID = 'TEST_USER_' + Date.now();
const CAMPAIGN_NAME = 'TEST_CAMPAIGN_' + Date.now();

async function runTest() {
    console.log("🚀 Starting V2 Logic Verification...");

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
            conditions: {},
            eligible_fields: [1, 2], // Only Field 1,2
            status: 'ACTIVE',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
        })
        .select()
        .single();

    if (cError) {
        console.error("❌ Failed to create campaign:", cError);
        return;
    }
    console.log(`✅ Campaign Created: ${campaign.id} (${campaign.name})`);

    // 2. Call 'collect-coupon' (Using direct Invoke for speed, simulating Edge Function call)
    // Note: We use supabase.functions.invoke
    console.log("\n📡 Invoking 'collect-coupon'...");
    const { data: collectResult, error: invokeError } = await supabase.functions.invoke('collect-coupon', {
        body: { userId: USER_ID, campaignId: campaign.id }
    });

    if (invokeError || (collectResult && collectResult.error)) {
        console.error("❌ Collect Failed:", invokeError || collectResult.error);
    } else {
        console.log("✅ Collect Success:", collectResult);
    }

    // 3. Call 'collect-coupon' AGAIN (Expect Duplicate Error)
    console.log("\n📡 Invoking 'collect-coupon' (Duplicate Test)...");
    const { data: dupResult, error: dupError } = await supabase.functions.invoke('collect-coupon', {
        body: { userId: USER_ID, campaignId: campaign.id }
    });

    if (dupResult && dupResult.error && dupResult.error.includes('Limit reached')) {
        console.log("✅ Check Passed: Duplicate prevented correctly.");
    } else {
        console.error("❌ Check Failed: Should have failed with Limit Reached.", dupResult || dupError);
    }

    // 4. Call 'get-my-coupons'
    console.log("\n📡 Invoking 'get-my-coupons'...");
    const { data: walletResult, error: walletError } = await supabase.functions.invoke('get-my-coupons', {
        body: { userId: USER_ID }
    });

    if (walletError || !walletResult.success) {
        console.error("❌ Wallet Fetch Failed:", walletError || walletResult);
    } else {
        const hasCoupon = walletResult.main.some((c) => c.campaign_id === campaign.id);
        if (hasCoupon) {
            console.log("✅ Check Passed: Coupon found in wallet.");
        } else {
            console.error("❌ Check Failed: Coupon NOT found in wallet.");
        }
    }

    // 5. Cleanup
    console.log("\n🧹 Cleaning up...");
    await supabase.from('user_coupons').delete().eq('user_id', USER_ID);
    await supabase.from('campaigns').delete().eq('id', campaign.id);
    console.log("✅ Cleanup complete.");
}

runTest();
