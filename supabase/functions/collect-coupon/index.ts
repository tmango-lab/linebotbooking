
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 2. Setup Supabase Client (Service Role for Admin Access)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 3. Parse Input
        const { userId, campaignId, secretCode } = await req.json();

        if (!userId) {
            throw new Error('User ID is required');
        }

        let targetCampaignId = campaignId;

        // 3.1 Lookup Campaign by Secret Code if ID is missing
        if (!targetCampaignId && secretCode) {
            const { data: foundCampaigns, error: findError } = await supabase
                .from('campaigns')
                .select('id')
                .contains('secret_codes', [secretCode])
                .eq('status', 'active')
                .limit(1);

            if (findError || !foundCampaigns || foundCampaigns.length === 0) {
                // Try case-insensitive search or just fail
                throw new Error('Invalid Secret Code (No campaign found)');
            }
            targetCampaignId = foundCampaigns[0].id;
            console.log(`[Secret Code Match] Code "${secretCode}" maps to Campaign ${targetCampaignId}`);
        }

        if (!targetCampaignId) {
            throw new Error('Missing Campaign ID or Invalid Secret Code');
        }

        console.log(`[Collect Checking] User: ${userId}, Campaign: ${targetCampaignId}`);

        // 4. Fetch Campaign Details (Availability Check)
        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', targetCampaignId)
            .single();

        if (campaignError || !campaign) {
            throw new Error('Campaign not found');
        }

        // 5. Validate Campaign Status & Time
        const now = new Date();
        if (campaign.status !== 'ACTIVE') {
            throw new Error('Campaign is not active');
        }
        if (campaign.start_date && now < new Date(campaign.start_date)) {
            throw new Error('Campaign has not started yet');
        }
        if (campaign.end_date && now > new Date(campaign.end_date)) {
            throw new Error('Campaign has ended');
        }

        // 6. Validate Secret Code (If needed)
        // Logic: If campaign is NOT public, require a valid secret code.
        // Or if secretCode is provided, check if it matches one of the codes.
        if (!campaign.is_public) {
            if (!secretCode) {
                throw new Error('This is a private campaign. Secret code required.');
            }
            if (!campaign.secret_codes || !campaign.secret_codes.includes(secretCode)) {
                throw new Error('Invalid secret code');
            }
        }

        // 7. Check User Quota
        const { count: userCount, error: countError } = await supabase
            .from('user_coupons')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('campaign_id', targetCampaignId);

        if (countError) throw countError;

        if (userCount !== null && userCount >= (campaign.limit_per_user || 1)) {
            throw new Error('You have already collected this coupon (Limit reached)');
        }

        // 8. Atomic Inventory Deduction (The "Check-Before-Act" Rule)
        // If total_quantity is managed (not null)
        if (campaign.remaining_quantity !== null) {
            if (campaign.remaining_quantity <= 0) {
                throw new Error('Coupon is fully redeemed (Out of Stock)');
            }

            // Atomic Warning: Ideally we use RPC for pure atomic, but single UPDATE with condition is semi-safe in Postgres.
            // UPDATE campaigns SET remaining = remaining - 1 WHERE id = ... AND remaining > 0
            const { data: updated, error: updateError } = await supabase
                .from('campaigns')
                .update({ remaining_quantity: campaign.remaining_quantity - 1 })
                .eq('id', targetCampaignId)
                .eq('remaining_quantity', campaign.remaining_quantity) // Optimistic Lock: Value must match what we read
                .gt('remaining_quantity', 0) // Extra Safety
                .select();

            if (updateError) throw updateError;
            if (!updated || updated.length === 0) {
                // Determine why it failed: Likely race condition (inventory changed)
                throw new Error('Failed to collect: Inventory updated by someone else. Please try again.');
            }
        }

        // 9. Assign Coupon to User
        // Calculate Expiry
        let expiresAt = campaign.end_date; // Default to campaign end
        if (campaign.duration_days) {
            const dynamicExpiry = new Date(now.getTime() + (campaign.duration_days * 24 * 60 * 60 * 1000));
            // Cap at campaign end_date if exists
            if (campaign.end_date && dynamicExpiry > new Date(campaign.end_date)) {
                expiresAt = campaign.end_date;
            } else {
                expiresAt = dynamicExpiry.toISOString();
            }
        }

        const { data: newCoupon, error: insertError } = await supabase
            .from('user_coupons')
            .insert({
                user_id: userId,
                campaign_id: targetCampaignId,
                status: 'ACTIVE',
                expires_at: expiresAt
            })
            .select()
            .single();

        if (insertError) {
            // In a perfect world, rollback inventory here. 
            // But for this simplified flow, we log strict error.
            console.error('[CRITICAL] Inventory deducted but Coupon insert failed', insertError);
            throw new Error('System Error: Could not generate coupon after inventory deduction.');
        }

        console.log(`[Success] Coupon ${newCoupon.id} collected for ${userId}`);

        return new Response(JSON.stringify({
            success: true,
            data: {
                ...newCoupon,
                campaign: {
                    name: campaign.name,
                    description: campaign.description,
                    eligible_fields: campaign.eligible_fields,
                    payment_methods: campaign.payment_methods,
                    valid_time_start: campaign.valid_time_start,
                    valid_time_end: campaign.valid_time_end,
                    image_url: campaign.image_url
                }
            },
            message: 'Coupon collected successfully'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('[Collect Error]', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
