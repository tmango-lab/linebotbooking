
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIMESTAMP = Date.now();
const BOOKING_ID = `test_ag_${TIMESTAMP}`;
const USER_ID = `user_ag_${TIMESTAMP}`;
const CAMPAIGN_ID = '00000000-0000-0000-0000-000000000000'; // Dummy UUID if constraints allow, or create real one
// Actually, foreign key constraint on user_coupons.campaign_id might exist.
// We should create a dummy campaign first to be safe, or check constraints.
// Schema says `campaign_id UUID REFERENCES campaigns(id)`. So we MUST create a campaign.

const CAMPAIGN_NAME = `AntiGaming_Test_${TIMESTAMP}`;

async function runTest() {
    console.log(`🚀 Starting Anti-Gaming Verification for Booking ${BOOKING_ID}`);

    // 1. Create Dummy Campaign
    const { data: campaign, error: cError } = await supabase
        .from('campaigns')
        .insert({
            name: CAMPAIGN_NAME,
            coupon_type: 'MAIN',
            benefit_type: 'DISCOUNT',
            benefit_value: { amount: 100 },
            status: 'ACTIVE'
        })
        .select()
        .single();

    if (cError) {
        console.error("❌ Failed to create campaign:", cError);
        return;
    }
    const campaignId = campaign.id;
    console.log(`✅ Created Campaign: ${campaignId}`);

    // 2. Create Dummy Booking
    // Initial: 2 Hours, 1000 THB
    const { error: bError } = await supabase
        .from('bookings')
        .insert({
            booking_id: BOOKING_ID,
            user_id: USER_ID,
            status: 'confirmed',
            date: '2026-01-30',
            time_from: '10:00:00',
            time_to: '12:00:00',
            duration_h: 2.0,
            price_total_thb: 1000,
            field_no: 1
        });

    if (bError) {
        console.error("❌ Failed to create booking:", bError);
        return;
    }
    console.log(`✅ Created Booking: ${BOOKING_ID} (Price: 1000, Duration: 2h)`);

    // 3. Create Coupon (USED)
    const { data: coupon, error: couponError } = await supabase
        .from('user_coupons')
        .insert({
            user_id: USER_ID,
            campaign_id: campaignId,
            status: 'USED',
            booking_id: BOOKING_ID,
            used_at: new Date().toISOString()
        })
        .select()
        .single();

    if (couponError) {
        console.error("❌ Failed to create coupon:", couponError);
        return;
    }
    console.log(`✅ Created Coupon (USED) linked to booking.`);

    // --- TEST 1: Reduce Price (1000 -> 900) ---
    console.log("\n🧪 Test 1: Reduce Price (1000 -> 900)");
    const { error: iError1 } = await supabase.functions.invoke('update-booking', {
        body: {
            matchId: BOOKING_ID,
            price: 900,
            // Keep time same implicitly or explicitly? 
            // logic checks: newPrice < oldPrice. 
            // If I don't send time, newDuration = oldDuration. 900 < 1000 => Kick.
        }
    });

    if (iError1) console.error("❌ Invoke Error 1:", iError1);

    // Check Coupon Status
    let { data: check1 } = await supabase.from('user_coupons').select('status, booking_id').eq('id', coupon.id).single();
    if (check1.status === 'ACTIVE' && check1.booking_id === null) {
        console.log("✅ PASS: Coupon released upon price reduction.");
    } else {
        console.error(`❌ FAIL: Coupon status is ${check1.status} (Expected ACTIVE).`);
    }

    // Reset Coupon to USED for Test 2
    await supabase.from('user_coupons').update({ status: 'USED', booking_id: BOOKING_ID, used_at: new Date().toISOString() }).eq('id', coupon.id);
    // Reset Booking Price to 1000
    await supabase.from('bookings').update({ price_total_thb: 1000 }).eq('booking_id', BOOKING_ID);

    // --- TEST 2: Reduce Duration (2h -> 1.5h) ---
    console.log("\n🧪 Test 2: Reduce Duration (2h -> 1.5h)");
    // 10:00 to 11:30
    const { error: iError2 } = await supabase.functions.invoke('update-booking', {
        body: {
            matchId: BOOKING_ID,
            timeStart: '2026-01-30 10:00:00',
            timeEnd: '2026-01-30 11:30:00'
        }
    });

    if (iError2) console.error("❌ Invoke Error 2:", iError2);

    let { data: check2 } = await supabase.from('user_coupons').select('status').eq('id', coupon.id).single();
    if (check2.status === 'ACTIVE') {
        console.log("✅ PASS: Coupon released upon duration reduction.");
    } else {
        console.error(`❌ FAIL: Coupon status is ${check2.status} (Expected ACTIVE).`);
    }

    // Reset Coupon to USED for Test 3
    await supabase.from('user_coupons').update({ status: 'USED', booking_id: BOOKING_ID, used_at: new Date().toISOString() }).eq('id', coupon.id);
    // Reset Booking to 1.5h (Wait, logic compares old vs new. Now booking is 1.5h. If I increase to 2.0h, it should STAY used.)
    // Current state in DB is 1.5h.

    // --- TEST 3: Increase Duration (1.5h -> 2.0h) ---
    console.log("\n🧪 Test 3: Increase Duration (1.5h -> 2.0h)");
    const { error: iError3 } = await supabase.functions.invoke('update-booking', {
        body: {
            matchId: BOOKING_ID,
            timeStart: '2026-01-30 10:00:00',
            timeEnd: '2026-01-30 12:00:00'
        }
    });

    if (iError3) console.error("❌ Invoke Error 3:", iError3);

    let { data: check3 } = await supabase.from('user_coupons').select('status').eq('id', coupon.id).single();
    if (check3.status === 'USED') {
        console.log("✅ PASS: Coupon retained upon duration increase.");
    } else {
        console.error(`❌ FAIL: Coupon status is ${check3.status} (Expected USED).`);
    }

    // Cleanup
    console.log("\n🧹 Cleaning up...");
    await supabase.from('user_coupons').delete().eq('id', coupon.id);
    await supabase.from('bookings').delete().eq('booking_id', BOOKING_ID);
    await supabase.from('campaigns').delete().eq('id', campaignId);
    console.log("✅ Done.");
}

runTest();
