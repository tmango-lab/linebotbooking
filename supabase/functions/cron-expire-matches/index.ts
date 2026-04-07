// supabase/functions/cron-expire-matches/index.ts
// Edge Function: ปิดห้องประกาศหาตี้อัตโนมัติเมื่อเลยเวลาที่กำหนด (expires_at)
// เรียกใช้ด้วย Supabase Cron (pg_cron) ทุกๆ 5 นาที หรือผ่าน HTTP request

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";

console.log("Cron Expire Matches Function Started");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Verify trigger method (allow POST or GET for easy testing)
    const isWebhook = req.method === 'POST' || req.method === 'GET';
    if (!isWebhook) {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // ─── Security Check ────────────────────────────────
    // To secure this endpoint, you could check for an API key in the headers.
    // For now, we will allow it since it's just a maintenance operation.
    const expectedKey = Deno.env.get('CRON_SECRET_KEY');
    const providedKey = req.headers.get('x-cron-key');

    if (expectedKey && providedKey !== expectedKey) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    // ──────────────────────────────────────────────────

    try {
        const now = new Date().toISOString();

        // ค้นหาห้องที่ยังเปิดอยู่และเลยเวลา expires_at แล้ว
        const { data: expiredMatches, error: selectError } = await supabase
            .from('open_matches')
            .select('id, booking_id, expires_at')
            .eq('status', 'open')
            .lte('expires_at', now);

        if (selectError) {
            throw new Error(`Select error: ${selectError.message}`);
        }

        if (!expiredMatches || expiredMatches.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'No matches to expire', count: 0 }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // อัพเดตสถานะเป็น 'expired'
        const matchIds = expiredMatches.map((m: any) => m.id);
        const { error: updateError } = await supabase
            .from('open_matches')
            .update({ status: 'expired', updated_at: now })
            .in('id', matchIds);

        if (updateError) {
            throw new Error(`Update error: ${updateError.message}`);
        }

        console.log(`[Cron] Successfully expired ${expiredMatches.length} matches:`, matchIds);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Expired ${expiredMatches.length} matches`, 
            expiredIds: matchIds 
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Cron Expire Error]:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
