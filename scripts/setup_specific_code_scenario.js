
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIMESTAMP = Date.now();
// Fixed ID to make it easy for user to find if they refresh
const BOOKING_ID = `booking_code_640198_${TIMESTAMP}`;
const USER_ID = `user_code_${TIMESTAMP}`;
const TARGET_CODE = '640198';

async function setupScenario() {
    console.log(`🚀 Setting up Scenario for Code: ${TARGET_CODE}`);

    // 1. Create/Get Campaign for this code
    // use .contains for TEXT[] column
    let { data: campaign } = await supabase.from('campaigns').select('*').contains('secret_codes', [TARGET_CODE]).maybeSingle();

    if (!campaign) {
        console.log(`Creating new campaign for code ${TARGET_CODE}...`);
        const { data: newCamp, error: cError } = await supabase
            .from('campaigns')
            .insert({
                name: `Test Campaign ${TARGET_CODE}`,
                secret_codes: [TARGET_CODE], // Correct: Array
                coupon_type: 'MAIN',
                benefit_type: 'DISCOUNT',
                benefit_value: { amount: 100 },
                status: 'ACTIVE'
            })
            .select()
            .single();
        if (cError) { console.error("Error creating campaign", cError); return; }
        campaign = newCamp;
    }

    console.log(`✅ Campaign Ready: ${campaign.name} (ID: ${campaign.id})`);

    // 2. Create Booking (1 Hour, 700 THB)
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
            field_no: 3,
            display_name: `Test Code ${TARGET_CODE} Use`,
            phone_number: '0912345678'
        });

    if (bError) { console.error("Error creating booking", bError); return; }

    // 3. Apply Coupon (USED)
    const { error: cpError } = await supabase
        .from('user_coupons')
        .insert({
            user_id: USER_ID,
            campaign_id: campaign.id,
            status: 'USED',
            booking_id: BOOKING_ID,
            used_at: new Date().toISOString()
        });

    if (cpError) { console.error("Error applying coupon", cpError); return; }

    console.log(`\n📊 REPORT:`);
    console.log(`- Booking ID: ${BOOKING_ID}`);
    console.log(`- Time: 22:00 - 23:00 (1 Hour)`);
    console.log(`- Original Price: 700 THB`);
    console.log(`- Code Applied: ${TARGET_CODE}`);
    console.log(`- Discount: 100 THB`);
    console.log(`- Final Price: 600 THB`);
    console.log(`\n(Please verify this price before updating to 1.5 Hours as requested.)`);
}

setupScenario();
