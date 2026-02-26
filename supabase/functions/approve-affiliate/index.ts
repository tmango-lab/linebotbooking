import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pushMessage } from "../_shared/lineClient.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { userId, action } = await req.json();

        if (!userId || !action) {
            return new Response(JSON.stringify({ error: 'Missing userId or action' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (action !== 'APPROVED' && action !== 'REJECTED') {
            return new Response(JSON.stringify({ error: 'Invalid action' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log(`[Approve Affiliate] Updating affiliate for user ${userId} to ${action}`);

        // Update Affiliate Status
        const { data: affiliate, error: updateError } = await supabase
            .from('affiliates')
            .update({ status: action, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select('*')
            .single();

        if (updateError) {
            console.error('[Approve Affiliate] DB Update Error:', updateError);
            throw new Error(`Failed to update affiliate: ${updateError.message}`);
        }

        // Send LINE Notification if APPROVED
        if (action === 'APPROVED' && affiliate?.user_id) {
            try {
                const message = {
                    type: 'text' as const,
                    text: `🎉 ระบบอนุมัติการเป็นผู้แนะนำของคุณแล้ว!\n\nคุณสามารถนำลิ้งก์แนะนำเพื่อนไปแชร์ เพื่อรับคูปองส่วนลด 100 บาท เมื่อเพื่อนจองและชำระเงินสำเร็จได้เลยครับ ⚽️🚀`
                };

                await pushMessage(affiliate.user_id, message);
                console.log(`[Approve Affiliate] Notification sent to ${affiliate.user_id}`);
            } catch (notifyError) {
                console.error('[Approve Affiliate] Failed to send LINE message:', notifyError);
                // We don't throw here, as the DB update was successful.
            }
        }

        return new Response(JSON.stringify({ success: true, affiliate }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('[Approve Affiliate] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
