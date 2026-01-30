
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
// Use a fixed ID or easy to find one if possible, but distinct enough.
const BOOKING_ID = `manual_upsell_${TIMESTAMP}`;
const USER_ID = `user_upsell_${TIMESTAMP}`;
const CAMPAIGN_NAME = `ManualUpsellTest_${TIMESTAMP}`;

async function runSetup() {
    console.log(`🚀 Setting up Manual Test Data...`);

    // 1. Create Campaign
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
    console.log(`✅ Created Campaign: ${campaign.name}`);

    // 2. Create Booking (22:00 - 23:00, Court 2, 700 THB)
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
            field_no: 2,
            display_name: 'Test Customer (Upsell)',
            phone_number: '0812345678'
        });

    if (bError) { console.error("❌ Failed to create booking:", bError); return; }
    console.log(`✅ Created Booking: 22:00-23:00 @ Court 2 (Price: 700)`);

    // 3. Create Coupon (USED)
    const { data: coupon, error: couponError } = await supabase
        .from('user_coupons')
        .insert({
            user_id: USER_ID,
            campaign_id: campaign.id,
            status: 'USED',
            booking_id: BOOKING_ID,
            used_at: new Date().toISOString()
        })
        .select()
        .single();

    if (couponError) { console.error("❌ Failed to create coupon:", couponError); return; }
    console.log(`✅ Applied Coupon (USED) to Booking.`);
    console.log(`\n🎉 SETUP COMPLETE!`);
    console.log(`You should now see a booking at 22:00 on Court 2.`);
    console.log(`Booking ID: ${BOOKING_ID}`);
}

runSetup();
