
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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get User ID from Body (POST) or Query (GET)
        // For security, ideally we rely on Auth Header, but for LIFF/Line verify we often pass userId explicitly signed.
        // Simplified for this phase.
        let userId = '';
        if (req.method === 'POST') {
            const body = await req.json();
            userId = body.userId;
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
                    conditions,
                    image_url,
                    eligible_fields,
                    payment_methods,
                    allowed_time_range,
                    days_of_week
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'ACTIVE')
            .gt('expires_at', now); // Must not be expired

        if (error) throw error;

        // Group by Type (Main vs On-Top)
        // Note: Supabase returns foreign key as single object or array depending on relation. REFERENCES campaigns(id) is singular.
        const mainCoupons: any[] = [];
        const onTopCoupons: any[] = [];

        coupons.forEach((c: any) => {
            const campaign = c.campaign;
            if (!campaign) return;

            const formatted = {
                coupon_id: c.id,
                campaign_id: campaign.id,
                name: campaign.name,
                description: campaign.description,
                expiry: c.expires_at,
                image: campaign.image_url,
                benefit: {
                    type: campaign.benefit_type,
                    value: campaign.benefit_value
                },
                conditions: {
                    fields: campaign.eligible_fields,
                    payment: campaign.payment_methods,
                    time: campaign.allowed_time_range,
                    days: campaign.days_of_week
                }
            };

            if (campaign.coupon_type === 'MAIN') {
                mainCoupons.push(formatted);
            } else {
                onTopCoupons.push(formatted);
            }
        });

        return new Response(JSON.stringify({
            success: true,
            main: mainCoupons,
            on_top: onTopCoupons,
            total: coupons.length
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
