
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
// Use Service Role to bypass RLS for creating bookings/coupons in test
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAMPAIGN_ID = '981d3f4c-d6ae-4f76-9e44-046e6f66f5be';
const USER_ID = 'LOSER';

async function testRedemptionLimit() {
    console.log(`--- Testing Redemption Limit for user '${USER_ID}' ---`);

    // 1. Collect Coupon (Simulate Wallet Page Auto-Collect)
    console.log(`\n1. Collecting coupon...`);
    // Check if expected to fail or succeed? 
    // If collection limit is NOT set, this should succeed.

    // Call collect-coupon function logic directly via Supabase client? 
    // No, easier to insert directly or call API. Let's call API function wrapper or just insert.
    // To properly test the "API" logic we should call the function URL. but local fetch to function might be tricky with authentication.
    // Let's just emulate the DB operations or use fetch if pointing to local functions.

    // We will use Local Functions endpoint (if running) or just insert to DB to skip collection logic if we assume collection is fine.
    // The user's URL implies "Collection" first.
    // Let's try to fetch the local function.

    const collectRes = await fetch(`${supabaseUrl}/functions/v1/collect-coupon`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
            userId: USER_ID,
            campaignId: CAMPAIGN_ID,
            secretCode: ''
        })
    });

    const collectData = await collectRes.json();
    console.log('Collection Result:', collectData);

    // If verified error (limit reached), we stop. But we expect Success on collection, failure on booking.
    if (collectData.error && !collectData.error.includes('already collected')) {
        console.error('Collection failed unexpectedly:', collectData.error);

        // Check if user already has it
        const { data: existing } = await supabase.from('user_coupons').select('id').eq('user_id', USER_ID).eq('campaign_id', CAMPAIGN_ID).single();
        if (existing) {
            console.log('User already has coupon, proceeding to booking test.');
        } else {
            return;
        }
    }

    // Get User Coupon ID
    const { data: userCoupon, error: ucError } = await supabase
        .from('user_coupons')
        .select('id')
        .eq('user_id', USER_ID)
        .eq('campaign_id', CAMPAIGN_ID)
        .eq('status', 'ACTIVE') // Must be active to use
        .maybeSingle();

    if (!userCoupon) {
        console.error('No active coupon found for user to use.');
        return;
    }

    console.log(`\n2. Attempting Booking with coupon ${userCoupon.id}...`);

    // 2. Create Booking (Simulate Booking Page)
    const bookingPayload = {
        userId: USER_ID,
        fieldId: 1,
        date: '2026-02-06', // Tomorrow
        startTime: '10:00',
        endTime: '11:00',
        customerName: 'Mr. Loser',
        phoneNumber: '0812345678',
        couponId: userCoupon.id,
        paymentMethod: 'field' // Normalized to CASH by our fix
    };

    const bookRes = await fetch(`${supabaseUrl}/functions/v1/create-booking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(bookingPayload)
    });

    const bookData = await bookRes.json();
    console.log('Booking Result:', bookData);

    if (bookData.success) {
        console.error('❌ TEST FAILED: Booking should have been rejected due to Global Limit!');
    } else {
        if (bookData.error && bookData.error.includes('limit reached')) {
            console.log('✅ TEST PASSED: Booking correctly rejected: ' + bookData.error);
        } else {
            console.log('⚠️ TEST RESULT: Booking rejected but maybe for wrong reason?', bookData.error);
        }
    }
}

testRedemptionLimit();
