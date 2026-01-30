
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIMESTAMP = Date.now();
const BOOKING_ID = `manual_test_${TIMESTAMP}`;
const USER_ID = `admin_tester`;
const CAMPAIGN_NAME = `Manual_Test_Campaign_${TIMESTAMP}`;

// Get Today's Date in YYYY-MM-DD
const today = new Date();
const dateStr = today.toISOString().split('T')[0];

async function runSetup() {
    console.log(`🚀 Setting up Manual Anti-Gaming Test on ${dateStr}`);

    // 1. Create Campaign
    const { data: campaign, error: cError } = await supabase
        .from('campaigns')
        .insert({
            name: CAMPAIGN_NAME,
            coupon_type: 'MAIN',
            benefit_type: 'DISCOUNT',
            benefit_value: { amount: 50 },
            status: 'ACTIVE'
        })
        .select()
        .single();

    if (cError) return console.error("❌ Campaign Create Error:", cError);
    console.log(`✅ Created Campaign: ${campaign.name}`);

    // 2. Create Booking (High Value)
    // 20:00 - 22:00 (2 Hours)
    const { error: bError } = await supabase
        .from('bookings')
        .insert({
            booking_id: BOOKING_ID,
            user_id: USER_ID,
            display_name: "Anti-Gaming Test User",
            status: 'confirmed',
            date: dateStr,
            time_from: '20:00:00',
            time_to: '22:00:00', // 2 Hours
            duration_h: 2.0,
            price_total_thb: 1400, // Price manually set high
            field_no: 1,
            notes: "Try to shorten this booking!"
        });

    if (bError) return console.error("❌ Booking Create Error:", bError);
    console.log(`✅ Created Booking: ${BOOKING_ID} (20:00-22:00, 1400 THB)`);

    // 3. Create & Attach Coupon
    const { data: coupon, error: couponError } = await supabase
        .from('user_coupons')
        .insert({
            user_id: USER_ID,
            campaign_id: campaign.id,
            status: 'USED', // Already applied
            booking_id: BOOKING_ID,
            used_at: new Date().toISOString()
        })
        .select()
        .single();

    if (couponError) return console.error("❌ Coupon Attach Error:", couponError);
    console.log(`✅ Coupon Attached (Status: USED)`);
    console.log(`\n👉 GOAL: Go to Admin Dashboard -> Field 1 -> 20:00.`);
    console.log(`👉 ACTION: Shrink it to 1 Hour (20:00-21:00) or change price to < 1400.`);
    console.log(`👉 EXPECTATION: Coupon status in DB should become 'ACTIVE'.`);
}

runSetup();
