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

        const url = new URL(req.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            throw new Error('Missing userId parameter');
        }

        // Fetch user coupons with campaign details
        const { data: coupons, error } = await supabase
            .from('user_coupons')
            .select(`
        id,
        status,
        expires_at,
        created_at,
        campaign:campaigns (
          id,
          name,
          coupon_type,
          benefit_type,
          benefit_value,
          conditions
        )
      `)
            .eq('user_id', userId)
            .eq('status', 'ACTIVE'); // Only ACTIVE coupons

        if (error) throw error;

        // Group by type: MAIN vs ONTOP
        const wallet = {
            main: [] as any[],
            on_top: [] as any[]
        };

        coupons?.forEach((c: any) => {
            const type = c.campaign?.coupon_type;
            const item = {
                id: c.id, // user_coupon_id
                campaign_id: c.campaign.id,
                name: c.campaign.name,
                benefit_type: c.campaign.benefit_type,
                benefit_value: c.campaign.benefit_value,
                conditions: c.campaign.conditions,
                expires_at: c.expires_at,
                created_at: c.created_at
            };

            if (type === 'MAIN') {
                wallet.main.push(item);
            } else if (type === 'ONTOP') {
                wallet.on_top.push(item);
            }
        });

        return new Response(JSON.stringify(wallet), {
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
