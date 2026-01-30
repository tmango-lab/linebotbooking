
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIMESTAMP = Date.now();
const BOOKING_ID = `test_increase_${TIMESTAMP}`;
const USER_ID = `user_inv_${TIMESTAMP}`; // Use a unique user ID
const CAMPAIGN_NAME = `IncreaseDurationTest_${TIMESTAMP}`;

async function runTest() {
    console.log(`🚀 Starting User Scenario Test: Increase Duration with Coupon`);
    console.log(`📝 Scenario: Booking 1 Hour -> Update to 1.5 Hours.`);
    console.log(`🎯 Expectation: Coupon should REMAIN 'USED' (because value increased).`);

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

    if (cError) { console.error("❌ Failed to create campaign:", cError); return; }
    const campaignId = campaign.id;

    // 2. Create Initial Booking (1 Hour)
    // 22:00 - 23:00, Price 700
    const { error: bError } = await supabase
        .from('bookings')
        .insert({
            booking_id: BOOKING_ID,
            user_id: USER_ID,
            status: 'confirmed',
            date: '2026-01-30',
            time_from: '22:00:00',
            time_to: '23:00:00',
            duration_h: 1.0,
            price_total_thb: 700,
            field_no: 2
        });

    if (bError) { console.error("❌ Failed to create booking:", bError); return; }
    console.log(`✅ Created Booking: 1 Hour (22:00-23:00), Price 700`);

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
        .select() // Ensure we get the ID back
        .single();

    if (couponError) { console.error("❌ Failed to create coupon:", couponError); return; }
    if (!coupon) { console.error("❌ Coupon created is null"); return; }
    console.log(`✅ Applied Coupon: USED (Status: USED, ID: ${coupon.id})`);

    // 4. Update Booking to 1.5 Hours (22:00 - 23:30)
    // New Price estimate: 1050 (Just needs to be >= 700 to pass price check, but realistic is higher)
    console.log(`\n🔄 Updating Booking to 1.5 Hours (22:00 - 23:30) with Price 1050...`);
    const { error: invokeError, data: invokeData } = await supabase.functions.invoke('update-booking', {
        body: {
            matchId: BOOKING_ID,
            timeStart: '2026-01-30 22:00:00',
            timeEnd: '2026-01-30 23:30:00',
            price: 1050,
            adminNote: 'Updated duration test',
            courtId: 2
        }
    });

    if (invokeError) {
        console.error("❌ Update Failed:", invokeError);
    } else {
        console.log("✅ Update API Call Success");
    }

    // 5. Verify Coupon Status
    const { data: checkToken, error: checkError } = await supabase
        .from('user_coupons')
        .select('status')
        .eq('id', coupon.id)
        .single();

    if (checkError) { console.error("❌ Failed to check coupon:", checkError); }
    else {
        if (checkToken.status === 'USED') {
            console.log(`\n✅ PASS: Coupon Status is '${checkToken.status}' (As Expected)`);
        } else {
            console.error(`\n❌ FAIL: Coupon Status is '${checkToken.status}' (Expected 'USED')`);
        }
    }

    // Cleanup
    console.log("\n🧹 Cleaning up...");
    await supabase.from('user_coupons').delete().eq('id', coupon.id);
    await supabase.from('bookings').delete().eq('booking_id', BOOKING_ID);
    await supabase.from('campaigns').delete().eq('id', campaignId);
    console.log("✅ Done.");
}

runTest();
