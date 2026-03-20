
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        // Connect to Postgres directly to run DDL
        const dbUrl = Deno.env.get('SUPABASE_DB_URL');
        if (!dbUrl) throw new Error('Missing SUPABASE_DB_URL');

        const client = new Client(dbUrl);
        await client.connect();

        const sql = `
            -- Remove unique constraint to allow multiple referral coupons
            DROP INDEX IF EXISTS public.idx_user_coupons_unique_active;

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


        await client.queryArray(sql);

        await client.end();

        return new Response(JSON.stringify({ success: true, message: "Policies updated successfully" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
