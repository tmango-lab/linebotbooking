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

        const { secretCode } = await req.json();

        if (!secretCode) {
            throw new Error('Secret code is required');
        }

        // Find campaign by secret code
        const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id')
            .contains('secret_codes', [secretCode])
            .limit(1);

        if (!campaigns || campaigns.length === 0) {
            throw new Error('Campaign not found');
        }

        const campaignId = campaigns[0].id;

        // Delete user coupons for this campaign
        const { data, error } = await supabase
            .from('user_coupons')
            .delete()
            .eq('campaign_id', campaignId)
            .select();

        if (error) throw error;

        return new Response(JSON.stringify({
            success: true,
            deleted: data?.length || 0,
            message: `Deleted ${data?.length || 0} test coupons`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('[Cleanup Error]', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
