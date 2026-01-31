
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY // CHANGED: Use Service Role Key for Edge Functions
const supabase = createClient(supabaseUrl, supabaseKey)

// Configuration - REAL DATA (31 Jan 2026, Field 3, 22:00)
const BOOKING_ID = "test-fair-" + Math.floor(Math.random() * 10000);
const USER_ID = "U123456789"; // Sim User
const COUPON_ID = "T" + Math.floor(Math.random() * 10000).toString().padStart(5, '0').slice(0, 5);
const TEST_DATE = "2026-01-31"; // วันนี้
const TEST_FIELD = 3; // สนาม 3
const TEST_START_TIME = "22:00:00"; // 22:00

async function runTest() {
    console.log(`\n🧪 Starting Anti-Gaming "Fair Revert" Test`);
    console.log(`Booking ID: ${BOOKING_ID}`);
    console.log(`Date: ${TEST_DATE}, Field: ${TEST_FIELD}, Start: ${TEST_START_TIME}`);

    // 1. Create Initial Booking (2 Hours: 22:00-00:00)
    console.log(`\n[Step 1] Creating Initial Booking (2 Hours: 22:00-00:00)...`);
    const { error: createError } = await supabase.from('bookings').insert({
        booking_id: BOOKING_ID,
        user_id: USER_ID,
        field_no: TEST_FIELD,
        price_total_thb: 2400, // Field 3 post-18:00 = 1200/hr × 2 = 2400
        time_from: TEST_START_TIME,
        time_to: "00:00:00", // 2 hours later (next day)
        duration_h: 2,
        date: TEST_DATE,
        status: "confirmed",
        is_promo: true
    });
    if (createError) throw createError;

    // 2. Apply V1 Promo Code (Commitment = 2 Hours, Discount 100 THB)
    console.log(`[Step 2] Applying Promo Code (Commitment: 2 Hours, Final: 2300 THB)...`);
    const { error: promoError } = await supabase.from('promo_codes').insert({
        code: COUPON_ID,
        booking_id: BOOKING_ID,
        user_id: USER_ID,
        field_id: TEST_FIELD,
        booking_date: TEST_DATE,
        time_from: TEST_START_TIME,
        time_to: "00:00:00",
        original_price: 2400,
        final_price: 2300, // 2400 - 100
        discount_type: 'fixed',
        discount_value: 100,
        expires_at: "2026-12-31 23:59:59",
        status: 'used',
        discount_amount: 100,
        duration_h: 2 // ANCHOR: Original Commitment
    });
    if (promoError) throw promoError;

    // 3. Extend Booking (2h -> 3h: 22:00-01:00)
    console.log(`[Step 3] Extending Booking to 3 Hours (22:00-01:00)...`);
    await callUpdateBooking(BOOKING_ID, {
        timeStart: `${TEST_DATE} ${TEST_START_TIME}`,
        timeEnd: "2026-02-01 01:00:00", // 3 Hours (next day)
        price: 3600 // Field 3: 1200 × 3 = 3600
    });

    // Verify Is Still Alive
    let promo = await getPromoStatus(BOOKING_ID);
    console.log(`   > Promo Status after Extend: ${promo.status} (Expected: used)`);

    // 4. Revert Booking (3h -> 2h) - The "Fair Revert"
    console.log(`[Step 4] Reverting Booking back to 2 Hours (Fair Revert: 22:00-00:00)...`);
    await callUpdateBooking(BOOKING_ID, {
        timeStart: `${TEST_DATE} ${TEST_START_TIME}`,
        timeEnd: "2026-02-01 00:00:00", // Back to 2 Hours
        price: 2400 // Back to original 2400
    });

    // Verify Result
    promo = await getPromoStatus(BOOKING_ID);
    console.log(`   > Promo Status after Revert: ${promo.status}`);

    if (promo.status === 'used') {
        console.log(`✅ SUCCESS: Fair Revert Allowed! Code survived.`);
    } else {
        console.log(`❌ FAILED: Code was burned/released incorrectly (Status: ${promo.status}).`);
    }

    // 5. Shrink Booking (2h -> 1h) - The "Cheat"
    console.log(`\n[Step 5] Shrinking Booking to 1 Hour (Cheat: 22:00-23:00)...`);
    await callUpdateBooking(BOOKING_ID, {
        timeStart: `${TEST_DATE} ${TEST_START_TIME}`,
        timeEnd: `${TEST_DATE} 23:00:00`, // 1 Hour
        price: 1200 // Will be recalculated to FULL PRICE by Anti-Gaming
    });

    // Verify Result - Query by CODE because booking_id is set to null when burned
    promo = await getPromoByCode(COUPON_ID);
    const booking = await getBookingDetails(BOOKING_ID);
    console.log(`   > Promo Status after Shrink: ${promo.status}`);
    console.log(`   > Promo booking_id after Shrink: ${promo.booking_id}`);
    console.log(`   > Booking Price after Shrink: ${booking.price_total_thb} THB (Expected: 1200 FULL PRICE)`);

    if (promo.status === 'expired' && promo.booking_id === null) {
        console.log(`✅ SUCCESS: Cheat Detected! Code burned (expired, unlinked from booking).`);
        if (booking.price_total_thb === 1200) {
            console.log(`✅ SUCCESS: Full price charged correctly (1200 THB).`);
        } else {
            console.log(`❌ FAILED: Price not recalculated (Got: ${booking.price_total_thb}, Expected: 1200).`);
        }
    } else {
        console.log(`❌ FAILED: Cheat allowed (Code status: ${promo.status}, booking_id: ${promo.booking_id}).`);
    }

    // Cleanup
    await supabase.from('bookings').delete().eq('booking_id', BOOKING_ID);
    await supabase.from('promo_codes').delete().eq('booking_id', BOOKING_ID);
}

async function callUpdateBooking(matchId, payload) {
    const { data, error } = await supabase.functions.invoke('update-booking', {
        body: { matchId, ...payload }
    });
    if (error) {
        console.error("Edge Function Error:", JSON.stringify(error, null, 2));
        console.error("Error Context:", error.context);
    }
    if (data) {
        if (data.error) {
            console.error("❌ Function returned error:", data.error);
            if (data.stack) console.error("Stack:", data.stack);
        } else {
            console.log("✅ Function success:", data.success);
        }
    }
}

async function getPromoStatus(bookingId) {
    const { data } = await supabase.from('promo_codes').select('*').eq('booking_id', bookingId).single();
    return data || {};
}

async function getPromoByCode(code) {
    const { data } = await supabase.from('promo_codes').select('*').eq('code', code).single();
    return data || {};
}

async function getBookingDetails(bookingId) {
    const { data } = await supabase.from('bookings').select('*').eq('booking_id', bookingId).single();
    return data || {};
}

runTest().catch(console.error);
