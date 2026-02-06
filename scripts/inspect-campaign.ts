
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
// Use Service Role to allow seeing everything
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAMPAIGN_ID = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';
const USER_ID = 'WINNER';

async function inspectCampaign() {
    console.log(`Inspecting Campaign: ${CAMPAIGN_ID}`);

    // 1. Fetch Campaign
    const { data: campaign, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', CAMPAIGN_ID)
        .single();

    if (error) {
        console.error('Error fetching campaign:', error);
        return;
    }

    if (!campaign) {
        console.error('Campaign not found!');
        return;
    }

    console.log('Campaign Details:', {
        name: campaign.name,
        status: campaign.status,
        is_public: campaign.is_public,
        secret_codes: campaign.secret_codes,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        remaining_quantity: campaign.remaining_quantity,
        limit_per_user: campaign.limit_per_user,
        redemption_limit: campaign.redemption_limit,
        redemption_count: campaign.redemption_count,
        payment_methods: campaign.payment_methods
    });

    const now = new Date();
    console.log('Current Time:', now.toISOString());

    // 2. Check if User already collected
    const { data: userCoupon, error: ucError } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('campaign_id', CAMPAIGN_ID)
        .eq('user_id', USER_ID);

    if (ucError) console.error('Error checking user coupon:', ucError);
    console.log(`User '${USER_ID}' coupons:`, userCoupon);

    // Final result
    if (campaign.status !== 'ACTIVE') console.error('❌ FAIL: Campaign not ACTIVE');
    if (!campaign.is_public && (!campaign.secret_codes || campaign.secret_codes.length === 0)) console.warn('⚠️ WARN: Private campaign but no codes?');

    if (campaign.start_date && new Date(campaign.start_date) > now) console.error('❌ FAIL: Campaign not started');
    if (campaign.end_date && new Date(campaign.end_date) < now) console.error('❌ FAIL: Campaign ended');

    if (campaign.remaining_quantity !== null && campaign.remaining_quantity <= 0) console.error('❌ FAIL: Out of stock');

}

inspectCampaign();
