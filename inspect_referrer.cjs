
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const REFERRER_ID = 'Ua636ab14081b483636896549d2026398';

async function main() {
    console.log(`\n--- Inspecting Data for Referrer: ${REFERRER_ID} ---`);

    // 1. Check Affiliate Stats
    const { data: affiliate } = await supabase
        .from('affiliates')
        .select('total_referrals, total_earnings')
        .eq('user_id', REFERRER_ID)
        .single();
    console.log('Current Dashboard Stats:', affiliate);

    // 2. Count Active Referrals
    const { count: referralCount, data: referrals } = await supabase
        .from('referrals')
        .select('id, status, created_at, referee_id', { count: 'exact' })
        .eq('referrer_id', REFERRER_ID);

    console.log(`\nActual Referral Records Found: ${referralCount}`);
    if (referrals && referrals.length > 0) {
        console.table(referrals.map(r => ({ ...r, created_at: new Date(r.created_at).toLocaleString() })));
    }

    // 3. Count User Coupons
    const { count: couponCount, data: coupons } = await supabase
        .from('user_coupons')
        .select('id, status, campaign_id, created_at', { count: 'exact' })
        .eq('user_id', REFERRER_ID)
        .order('created_at', { ascending: false });

    console.log(`\nActual Coupons Found: ${couponCount}`);
    if (coupons && coupons.length > 0) {
        console.table(coupons.map(c => ({ ...c, created_at: new Date(c.created_at).toLocaleString() })));
    }
}

main();
