
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

        console.log(`[API Init] URL: ${supabaseUrl ? 'Set' : 'Missing'}`);
        console.log(`[API Init] Key Length: ${supabaseKey ? supabaseKey.length : 0}`);

        if (!supabaseKey) {
            console.error('[API Error] Service Role Key is MISSING');
            throw new Error('Server configuration error');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get User ID from Body (POST) or Query (GET)
        // For security, ideally we rely on Auth Header, but for LIFF/Line verify we often pass userId explicitly signed.
        // Simplified for this phase.
        let userId = '';
        if (req.method === 'POST') {
            const body = await req.json();
            userId = body.userId;
            console.log('[API] POST Body:', JSON.stringify(body));
        } else {
            const url = new URL(req.url);
            userId = url.searchParams.get('userId') ?? '';
        }

        if (!userId) {
            throw new Error('User ID is required');
        }

        console.log(`[Fetching Coupons] User: ${userId}`);

        const now = new Date().toISOString();

        // Fetch User's Active Coupons + Campaign Details
        const { data: coupons, error } = await supabase
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
                    reward_item,
                    min_spend,
                    conditions,
                    image_url,
                    eligible_fields,
                    payment_methods,
                    valid_time_start,
                    valid_time_end,
                    eligible_days,
                    is_stackable
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'ACTIVE')
            .gt('expires_at', now); // Must not be expired

        if (error) throw error;

        // [NEW] Fetch Profile securely (Bypassing RLS)
        const { data: profile } = await supabase
            .from('profiles')
            .select('team_name, phone_number')
            .eq('user_id', userId)
            .maybeSingle();

        // Group by Type (Main vs On-Top)
        // Note: Supabase returns foreign key as single object or array depending on relation. REFERENCES campaigns(id) is singular.
        const mainCoupons: any[] = [];
        const onTopCoupons: any[] = [];

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
                is_stackable: campaign.is_stackable || false
            };

            // Case-insensitive comparison
            const couponType = (campaign.coupon_type || 'main').toUpperCase();
            if (couponType === 'MAIN') {
                mainCoupons.push(formatted);
            } else {
                onTopCoupons.push(formatted);
            }
        });

        return new Response(JSON.stringify({
            success: true,
            main: mainCoupons,
            on_top: onTopCoupons,
            total: coupons.length,
            profile: profile || null // Return profile
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
