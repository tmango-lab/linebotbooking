
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
        // Check keys
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') ?? '';

        if (!supabaseKey) {
            console.error('[API Error] Service Role Key is MISSING');
            throw new Error('Server configuration error');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get User ID and Filter
        let userId = '';
        let filter = 'active'; // active | history

        if (req.method === 'POST') {
            const body = await req.json();
            userId = body.userId;
            if (body.filter) filter = body.filter;
            console.log('[API] POST Body:', JSON.stringify(body));
        } else {
            const url = new URL(req.url);
            userId = url.searchParams.get('userId') ?? '';
            const f = url.searchParams.get('filter');
            if (f) filter = f;
        }

        if (!userId) {
            throw new Error('User ID is required');
        }

        console.log(`[Fetching Coupons] User: ${userId}, Filter: ${filter}`);

        const now = new Date().toISOString();

        // Fix #2: Lazy Expiry — mark expired coupons before querying
        // This ensures Wallet displays accurate status without needing a cron job
        const { error: expireError } = await supabase
            .from('user_coupons')
            .update({ status: 'EXPIRED' })
            .eq('user_id', userId)
            .eq('status', 'ACTIVE')
            .lt('expires_at', now);

        if (expireError) {
            console.warn('[Lazy Expiry] Failed to mark expired coupons:', expireError.message);
        }

        // Build Query
        let query = supabase
            .from('user_coupons')
            .select(`
                id,
                status,
                expires_at,
                campaign:campaigns (
                    id,
                    name,
                    description,
                    coupon_type,
                    benefit_type,
                    benefit_value,
                    discount_amount,
                    discount_percent,
                    max_discount,
                    reward_item,
                    min_spend,
                    conditions,
                    image_url,
                    eligible_fields,
                    payment_methods,
                    valid_time_start,
                    valid_time_end,
                    eligible_days,
                    is_stackable,
                    allow_ontop_stacking
                )
            `)
            .eq('user_id', userId);

        if (filter === 'history') {
            // History: Used or Expired
            query = query.in('status', ['USED', 'EXPIRED']);
        } else {
            // Active: Status Active AND Not Expired
            query = query.eq('status', 'ACTIVE').gt('expires_at', now);
        }

        const { data: coupons, error } = await query;

        if (error) throw error;

        // [NEW] Fetch Profile securely (Bypassing RLS)
        const { data: profile } = await supabase
            .from('profiles')
            .select('team_name, phone_number')
            .eq('user_id', userId)
            .maybeSingle();

        // Group by Type (Main vs On-Top)
        const mainCoupons: any[] = [];
        const onTopCoupons: any[] = [];

        if (coupons) {
            coupons.forEach((c: any) => {
                const campaign = c.campaign;
                if (!campaign) return;

                // Robust Benefit Detection
                let bType = campaign.benefit_type || 'DISCOUNT';
                let bValue: any = campaign.benefit_value;

                // Fallback to dedicated columns if JSON is empty/legacy
                if (!bValue || Object.keys(bValue).length === 0) {
                    if (campaign.discount_amount > 0) {
                        bType = 'DISCOUNT';
                        bValue = { amount: campaign.discount_amount };
                    } else if (campaign.discount_percent > 0) {
                        bType = 'DISCOUNT';
                        bValue = { percent: campaign.discount_percent };
                    } else if (campaign.reward_item) {
                        bType = 'REWARD';
                        bValue = { item: campaign.reward_item };
                    }
                }

                const formatted = {
                    coupon_id: c.id,
                    campaign_id: campaign.id,
                    name: campaign.name,
                    description: campaign.description,
                    expiry: c.expires_at,
                    status: c.status,
                    image: campaign.image_url,
                    benefit: {
                        type: bType,
                        value: bValue
                    },
                    conditions: {
                        fields: campaign.eligible_fields,
                        payment: campaign.payment_methods,
                        time: {
                            start: campaign.valid_time_start,
                            end: campaign.valid_time_end
                        },
                        days: campaign.eligible_days,
                        min_spend: campaign.min_spend || 0
                    },
                    is_stackable: campaign.is_stackable || false,
                    allow_ontop_stacking: campaign.allow_ontop_stacking ?? true
                };

                // Case-insensitive comparison
                const couponType = (campaign.coupon_type || 'main').toUpperCase();
                if (couponType === 'MAIN') {
                    mainCoupons.push(formatted);
                } else {
                    onTopCoupons.push(formatted);
                }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            main: mainCoupons,
            on_top: onTopCoupons,
            total: coupons ? coupons.length : 0,
            profile: profile || null
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('[Get Coupons Error]', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
