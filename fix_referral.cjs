
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

const BOOKING_ID = '1771410640014';

async function main() {
    console.log(`Checking referral for booking ${BOOKING_ID}...`);

    // 1. Get Referral
    const { data: referral, error: refError } = await supabase
        .from('referrals')
        .select('*')
        .eq('booking_id', BOOKING_ID)
        .single();

    if (refError) {
        console.error('Error fetching referral:', refError);
        return;
    }

    if (referral.status === 'COMPLETED') {
        console.log('Referral already COMPLETED.');
        return;
    }

    console.log('Found Pending Referral:', referral.id);
    const referrerId = referral.referrer_id;
    const rewardAmount = referral.reward_amount || 100;

    // 2. Get/Create Campaign
    let { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('name', '🎁 รางวัลแนะนำเพื่อน')
        .eq('status', 'active')
        .maybeSingle();

    if (!campaign) {
        console.log('Creating Reward Campaign...');
        const { data: newCamp, error: createError } = await supabase
            .from('campaigns')
            .insert({
                name: '🎁 รางวัลแนะนำเพื่อน',
                description: 'คูปองเงินสดจากการแนะนำเพื่อนมาจองสนาม',
                status: 'active',
                discount_amount: rewardAmount,
                discount_percent: 0,
                coupon_type: 'main',
                start_date: new Date().toISOString(),
                end_date: '2026-05-31T23:59:59+07:00',
            })
            .select()
            .single();
        if (createError) throw createError;
        campaign = newCamp;
    }
    console.log('Campaign ID:', campaign.id);

    // 3. Create Coupon
    console.log(`Creating coupon for ${referrerId}...`);
    const { error: couponError } = await supabase
        .from('user_coupons')
        .insert({
            user_id: referrerId,
            campaign_id: campaign.id,
            status: 'ACTIVE',
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });

    if (couponError) {
        console.error('Coupon creation error:', couponError);
        // Determine if duplicate?
        // Proceed anyway to update status if coupon exists?
    } else {
        console.log('Coupon created successfully.');
    }

    // 4. Update Referral Status
    console.log('Updating Referral Status...');
    const { error: updateError } = await supabase
        .from('referrals')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('id', referral.id);

    if (updateError) console.error('Update Referral Error:', updateError);

    // 5. Update Affiliate Stats
    console.log('Updating Affiliate Stats...');

    const { count: totalReferrals } = await supabase
        .from('referrals')
        .select('id', { count: 'exact' })
        .eq('referrer_id', referrerId)
        .eq('status', 'COMPLETED');

    const { data: earningsData } = await supabase
        .from('referrals')
        .select('reward_amount')
        .eq('referrer_id', referrerId)
        .eq('status', 'COMPLETED');

    const totalEarnings = earningsData.reduce((sum, r) => sum + (r.reward_amount || 0), 0);

    const { error: affError } = await supabase
        .from('affiliates')
        .update({
            total_referrals: totalReferrals,
            total_earnings: totalEarnings,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', referrerId);

    if (affError) console.error('Affiliate Update Error:', affError);
    else console.log(`Affiliate Updated: ${totalReferrals} referrals, ${totalEarnings} earnings`);

    console.log('--- DONE ---');
}

main();
