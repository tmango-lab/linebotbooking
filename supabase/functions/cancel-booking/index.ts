
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { cancelMatchdayBooking } from "../_shared/matchdayApi.ts";

console.log("Cancel Booking Function Started");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { matchId, reason } = await req.json();

        if (!matchId) {
            return new Response(JSON.stringify({ error: 'Missing matchId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Cancel Booking] Request to cancel match ${matchId}. Reason: ${reason}`);

        await cancelMatchdayBooking(matchId, reason || "Cancelled via System");

        return new Response(JSON.stringify({ success: true, message: `Match ${matchId} cancelled successfully` }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[Cancel Booking Error]:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
