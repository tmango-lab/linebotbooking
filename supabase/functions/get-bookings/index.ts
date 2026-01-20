// supabase/functions/get-bookings/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchMatchdayMatches } from "../_shared/matchdayApi.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Get Bookings Function Started");

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log(`[Request] Method: ${req.method} | URL: ${req.url}`);

        let date;
        try {
            const body = await req.json();
            date = body.date;
            console.log(`[Request] Body:`, body);
        } catch (e) {
            console.error('[Request] Error parsing JSON body:', e);
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!date) {
            return new Response(JSON.stringify({ error: 'Date is required (YYYY-MM-DD)' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Process] Fetching bookings for date: ${date}`);

        // Check Token Availability (Do not log the full token)
        // @ts-ignore
        const token = Deno.env.get('MATCHDAY_TOKEN');
        console.log(`[Env] MATCHDAY_TOKEN available: ${!!token} (${token ? token.length : 0} chars)`);

        const matches = await fetchMatchdayMatches(date, 0);
        console.log(`[Process] Matches found: ${matches.length}`);

        return new Response(JSON.stringify({ bookings: matches }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('[Critical Error]:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error', stack: error.stack }), {
            status: 200, // Return 200 to see error in frontend easily
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
