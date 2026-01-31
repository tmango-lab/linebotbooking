
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";

console.log("Cancel Booking Function Started (Local DB Only)");

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
        const { matchId, reason, isRefunded } = await req.json();

        if (!matchId) {
            return new Response(JSON.stringify({ error: 'Missing matchId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Cancel Booking] Request to cancel booking ${matchId}. Reason: ${reason || 'N/A'}, Refunded: ${isRefunded}`);

        // Update booking status to cancelled in Local DB
        const { data, error } = await supabase
            .from('bookings')
            .update({
                status: 'cancelled',
                admin_note: (reason || 'Cancelled via System') + (isRefunded ? ' [REFUNDED]' : ''),
                is_refunded: !!isRefunded,
                updated_at: new Date().toISOString()
            })
            .eq('booking_id', String(matchId))
            .select()
            .single();

        if (error) {
            console.error('[Cancel Booking Error]:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Cancel Booking] Success: ${matchId}`);

        return new Response(JSON.stringify({
            success: true,
            message: `Booking ${matchId} cancelled successfully`,
            booking: data
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Cancel Booking Error]:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
