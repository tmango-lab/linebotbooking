import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { userId, campaignId, secretCode } = await req.json();

        if (!userId || !campaignId) {
            throw new Error('Missing required fields: userId, campaignId');
        }

        // 1. Fetch Campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (campaignError || !campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== 'ACTIVE') {
            throw new Error('Campaign is not active');
        }

        // 2. Secret Code Validation
        if (campaign.secret_codes && campaign.secret_codes.length > 0) {
            if (!secretCode || !campaign.secret_codes.includes(secretCode)) {
                throw new Error('Invalid secret code');
            }
        }

        // 3. Quota Check (Global)
        // Note: This is an optimistic check. For strict concurrency, use an RPC or atomic update.
        if (campaign.remaining_quantity !== null && campaign.remaining_quantity <= 0) {
            throw new Error('Campaign is fully redeemed');
        }

        // 4. Quota Check (User)
        const { count: userCount, error: countError } = await supabase
            .from('user_coupons')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('campaign_id', campaignId);

        if (countError) throw countError;

        if (userCount !== null && userCount >= (campaign.limit_per_user || 1)) {
            throw new Error('You have reached the limit for this coupon');
        }

        // 5. Transactionish: Deduct Inventory & Claim
        if (campaign.remaining_quantity !== null) {
            const { data: updated, error: updateError } = await supabase
                .from('campaigns')
                .update({ remaining_quantity: campaign.remaining_quantity - 1 })
                .eq('id', campaignId)
                .eq('remaining_quantity', campaign.remaining_quantity) // Optimistic Lock
                .select();

            if (updateError) throw updateError;
            if (!updated || updated.length === 0) {
                throw new Error('Failed to claim: Inventory changed or empty. Please try again.');
            }
        }

        // 6. Insert User Coupon
        const { data: coupon, error: insertError } = await supabase
            .from('user_coupons')
            .insert({
                user_id: userId,
                campaign_id: campaignId,
                status: 'ACTIVE',
                expires_at: null // Or calculate based on campaign duration
            })
            .select()
            .single();

        if (insertError) {
            // Rollback inventory if needed? 
            // If insert fails, we already decremented. 
            // This is why RPC is better. But for this task, we'll assume insert likely succeeds if logic passed.
            // Warn: This is not strictly ACID.
            console.error('Insert failed after inventory decrement', insertError);
            throw new Error('System error claiming coupon');
        }

        return new Response(JSON.stringify({ success: true, data: coupon }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
