// supabase/functions/get-bookings/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Get Bookings Function Started (Fully Inlined v2)");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
const token = Deno.env.get('MATCHDAY_TOKEN');
const MD_BASE_URL = 'https://arena.matchday-backend.com';

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log(`[Request] Method: ${req.method} | URL: ${req.url}`);

        // Get Date
        let date;
        try {
            const body = await req.json();
            date = body.date;
        } catch (e) {
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

        if (!token) {
            console.error('MATCHDAY_TOKEN is missing in environment');
            return new Response(JSON.stringify({ error: 'Server Config Error: MATCHDAY_TOKEN missing' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const url = `${MD_BASE_URL}/arena/matches`;
        const timeStart = `${date} 00:00:00`;
        const [year, month, day] = date.split('-').map(Number);
        const nextDay = new Date(year, month - 1, day + 1);
        const yyyy = nextDay.getFullYear();
        const mm = ('0' + (nextDay.getMonth() + 1)).slice(-2);
        const dd = ('0' + nextDay.getDate()).slice(-2);
        const timeEnd = `${yyyy}-${mm}-${dd} 00:00:00`;

        console.log(`[Matchday API] Requesting ${timeStart} to ${timeEnd}`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify({
                time_start: timeStart,
                time_end: timeEnd
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`Matchday API Error: ${res.status} - ${errText}`);
            return new Response(JSON.stringify({ error: `Matchday API Error: ${res.status}`, details: errText }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const mdText = await res.text();
        console.log('[Matchday Response]:', mdText);

        if (!mdText) {
            console.warn('[Matchday] Empty response body');
            return new Response(JSON.stringify({ bookings: [] }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let data;
        try {
            data = JSON.parse(mdText);
        } catch (e) {
            throw new Error(`Matchday API Invalid JSON: ${mdText.substring(0, 100)}...`);
        }

        console.log(`[Process] Matches found: ${Array.isArray(data) ? data.length : 'Invalid Data'}`);

        if (!Array.isArray(data)) {
            return new Response(JSON.stringify({ bookings: [] }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ bookings: data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('[Critical Error]:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
