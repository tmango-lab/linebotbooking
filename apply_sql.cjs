
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL');
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log('Connected to database.');

        const sql = `
            -- 8. Function: process_referral_reward_sql
            CREATE OR REPLACE FUNCTION public.process_referral_reward_sql(p_booking_id TEXT)
            RETURNS JSONB
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_referral RECORD;
                v_campaign_id UUID;
                v_referrer_id TEXT;
                v_reward_amount NUMERIC;
            BEGIN
                -- 1. Check referral
                SELECT * INTO v_referral FROM public.referrals 
                WHERE booking_id = p_booking_id AND status = 'PENDING_PAYMENT';

                IF NOT FOUND THEN
                    RETURN jsonb_build_object('success', false, 'message', 'No pending referral found');
                END IF;

                v_referrer_id := v_referral.referrer_id;
                v_reward_amount := COALESCE(v_referral.reward_amount, 100);

                -- 2. Find Reward Campaign
                SELECT id INTO v_campaign_id FROM public.campaigns 
                WHERE name = '🎁 รางวัลแนะนำเพื่อน' AND status = 'active' LIMIT 1;

                IF v_campaign_id IS NULL THEN
                    INSERT INTO public.campaigns (name, description, status, discount_amount, start_date, end_date)
                    VALUES ('🎁 รางวัลแนะนำเพื่อน', 'คูปองจากการแนะนำเพื่อน', 'active', v_reward_amount, NOW(), NOW() + INTERVAL '1 year')
                    RETURNING id INTO v_campaign_id;
                END IF;

                -- 3. Create Coupon
                INSERT INTO public.user_coupons (user_id, campaign_id, status, expires_at)
                VALUES (v_referrer_id, v_campaign_id, 'ACTIVE', NOW() + INTERVAL '3 months');

                -- 4. Update Referral Status
                UPDATE public.referrals SET status = 'COMPLETED', updated_at = NOW()
                WHERE id = v_referral.id;

                -- 5. Update Request Stats
                UPDATE public.affiliates SET 
                    total_referrals = (SELECT COUNT(*) FROM public.referrals WHERE referrer_id = v_referrer_id AND status = 'COMPLETED'),
                    total_earnings = (SELECT TRUNC(COALESCE(SUM(reward_amount), 0)) FROM public.referrals WHERE referrer_id = v_referrer_id AND status = 'COMPLETED'),
                    updated_at = NOW()
                WHERE user_id = v_referrer_id;

                RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'reward_amount', v_reward_amount);
            END;
            $$;

            -- Grant execute
            GRANT EXECUTE ON FUNCTION public.process_referral_reward_sql(TEXT) TO service_role;
            GRANT EXECUTE ON FUNCTION public.process_referral_reward_sql(TEXT) TO postgres;
            GRANT EXECUTE ON FUNCTION public.process_referral_reward_sql(TEXT) TO anon;
            GRANT EXECUTE ON FUNCTION public.process_referral_reward_sql(TEXT) TO authenticated;
    `;

        await client.query(sql);
        console.log('SQL function created successfully.');

    } catch (err) {
        console.error('Error applying SQL:', err);
    } finally {
        await client.end();
    }
}

main();
