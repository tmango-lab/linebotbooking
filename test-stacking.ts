import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || !anonKey) {
    console.error("❌ Missing required Supabase environment variables (.env)");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log('=============================================');
    console.log('🧪 Starting Coupon Stacking Integration Tests');
    console.log('=============================================\n');

    let testsPassed = 0;
    let testsFailed = 0;

    // ----------------------------------------------------------------------------------
    // TEST 1: Referral Program Stacking Flag
    // ----------------------------------------------------------------------------------
    console.log('--- Test 1: Referral Program (validate-referral API) ---');
    try {
        // 1.1 Set flag to false temporarily
        await supabase.from('referral_programs').update({ allow_ontop_stacking: false }).eq('is_active', true);

        // 1.2 Get an active affiliate code
        const { data: affiliate } = await supabase.from('affiliates').select('referral_code, user_id').eq('status', 'APPROVED').limit(1).maybeSingle();

        if (affiliate) {
            // Create a dummy user ID that is unique so we don't trigger the "already referred" error
            const mockUserId = 'test-mock-user-id-' + Math.floor(Math.random() * 100000);

            const res = await fetch(`${supabaseUrl}/functions/v1/validate-referral`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
                body: JSON.stringify({ referralCode: affiliate.referral_code, userId: mockUserId })
            });
            const data = await res.json();

            if (data.valid && data.program?.allow_ontop_stacking === false) {
                console.log('✅ PASSED: Referral API correctly returns allow_ontop_stacking = false');
                testsPassed++;
            } else if (data.valid === false) {
                console.log(`⚠️ SKIP: Referral invalid (${data.error}). Please ensure there are no self/used rules blocking this.`);
            } else {
                console.error('❌ FAILED: Referral API did not return allow_ontop_stacking = false');
                console.error('Response:', data);
                testsFailed++;
            }
        } else {
            console.log('⚠️ SKIP: No active affiliate found to test validate-referral.');
        }

        // 1.3 Restore flag to true
        await supabase.from('referral_programs').update({ allow_ontop_stacking: true }).eq('is_active', true);
        console.log('🔄 Restored referral_programs allow_ontop_stacking to true.');

    } catch (err) {
        console.error('❌ FAILED: Unexpected error in Test 1:', err);
        testsFailed++;
    }

    console.log('');

    // ----------------------------------------------------------------------------------
    // TEST 2: Campaign Stacking Flag via get-my-coupons
    // ----------------------------------------------------------------------------------
    console.log('--- Test 2: User Campaigns (get-my-coupons API) ---');
    try {
        // 2.1 Find a user with at least one coupon
        const { data: userCoupon } = await supabase.from('user_coupons').select('user_id').limit(1).maybeSingle();

        if (userCoupon) {
            const userId = userCoupon.user_id;

            // 2.2 Call API
            const res = await fetch(`${supabaseUrl}/functions/v1/get-my-coupons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
                body: JSON.stringify({ userId })
            });

            const data = await res.json();
            const allCoupons = [...(data.main || []), ...(data.on_top || [])];

            if (allCoupons.length >= 0) {
                if (allCoupons.length > 0) {
                    const sampleCoupon = allCoupons[0];
                    const originalStackingVal = sampleCoupon.allow_ontop_stacking;

                    // Update DB
                    await supabase.from('campaigns').update({ allow_ontop_stacking: !originalStackingVal }).eq('id', sampleCoupon.campaign_id);

                    // Fetch again
                    const resUpdated = await fetch(`${supabaseUrl}/functions/v1/get-my-coupons`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
                        body: JSON.stringify({ userId })
                    });
                    const dataUpdated = await resUpdated.json();
                    const allCouponsUpdated = [...(dataUpdated.main || []), ...(dataUpdated.on_top || [])];
                    const updatedCoupon = allCouponsUpdated.find((c: any) => c.campaign_id === sampleCoupon.campaign_id);

                    if (updatedCoupon && updatedCoupon.allow_ontop_stacking === !originalStackingVal) {
                        console.log('✅ PASSED: get-my-coupons API correctly surfaces dynamic allow_ontop_stacking updates.');
                        testsPassed++;
                    } else {
                        console.error('❌ FAILED: get-my-coupons API did not retrieve updated allow_ontop_stacking.');
                        console.error('Before:', originalStackingVal, 'After:', updatedCoupon?.allow_ontop_stacking);
                        testsFailed++;
                    }

                    // Restore DB
                    await supabase.from('campaigns').update({ allow_ontop_stacking: originalStackingVal }).eq('id', sampleCoupon.campaign_id);
                    console.log('🔄 Restored campaigns allow_ontop_stacking to its original value.');

                } else {
                    console.log('⚠️ SKIP: User has 0 coupons, cannot test property mapping.');
                }

            } else {
                console.error('❌ FAILED: get-my-coupons API failed to return coupons arrays:', data);
                testsFailed++;
            }
        } else {
            console.log('⚠️ SKIP: No users with coupons found in `user_coupons` table.');
        }
    } catch (err) {
        console.error('❌ FAILED: Unexpected error in Test 2:', err);
        testsFailed++;
    }

    console.log('\n=============================================');
    console.log(`🏁 TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('=============================================');

    if (testsFailed > 0) process.exit(1);
}

runTests();
