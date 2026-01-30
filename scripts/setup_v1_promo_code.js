
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
const CODE = '640198';

async function setupV1Code() {
    console.log(`🚀 Setting up V1 Promo Code: ${CODE}`);

    // 1. Check if exists, delete if so to reset
    const { error: delError } = await supabase.from('promo_codes').delete().eq('code', CODE);
    if (delError) console.log("Note: Delete existing code error (might not exist):", delError.message);

    // 2. Insert new code
    // Assuming this code is for a specific slot: 22:00-23:00 on Field 2 (as per user context)
    const { data, error } = await supabase
        .from('promo_codes')
        .insert({
            code: CODE,
            user_id: `user_v1_${TIMESTAMP}`, // Dummy user who "owns"/created this code (e.g. via LINE)
            field_id: 2,
            booking_date: '2026-01-30',
            time_from: '22:00:00',
            time_to: '23:00:00',
            duration_h: 1.0,
            original_price: 700,
            discount_type: 'fixed', // Fixed amount discount
            discount_value: 100,
            discount_amount: 100,
            final_price: 600,
            status: 'active',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expires in 24 hours
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error("❌ Failed to create promo code:", error);
        return;
    }

    console.log(`✅ Promo Code ${CODE} Created!`);
    console.log(JSON.stringify(data, null, 2));
    console.log(`\nReady for user to test on Dashboard.`);
}

setupV1Code();
