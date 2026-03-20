import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("No service role key found. Please run with SUPABASE_SERVICE_ROLE_KEY=...");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Setting up test referral...");

    // 1. Ensure an active referral program exists with terms required
    const { error: progErr } = await supabase.from('referral_programs').upsert({
        id: 9999,
        name: 'Test Program',
        is_active: true,
        discount_percent: 50,
        reward_amount: 100,
        require_term_consent: true,
        term_consent_message: 'ยอมรับเงื่อนไขการใช้ส่วนลดแนะนำเพื่อน (ห้ามคืนเงินเด็ดขาด)',
    });
    if (progErr) console.error("Program error:", progErr);

    // 2. Create the affiliate code
    const { data: aff, error: affErr } = await supabase.from('affiliates').upsert({
        user_id: 'TEST-REFERRER-1',
        referral_code: 'TESTREF50',
        status: 'APPROVED',
    }).select();

    if (affErr) {
        console.error("Affiliate error:", affErr);
    } else {
        console.log("Successfully created/updated test referral: TESTREF50");
    }
}

main();
