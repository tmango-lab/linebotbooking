
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import { fetchMatchdayMatches } from "../_shared/matchdayApi.ts";

console.log("Get Bookings Function Started (Hybrid Data Source v2)");

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

        // 1. Fetch from Matchday (Source of Truth for Availability)
        const matchdayBookings = await fetchMatchdayMatches(date, 0);
        console.log(`[Matchday] Retrieved ${matchdayBookings.length} records`);

        // 2. Fetch from Local Database (Source for Notes & Overrides)
        const ids = matchdayBookings.map(b => String(b.id)); // Ensure ID is string

        // Map for merging
        let localDataMap: Record<string, any> = {};

        if (ids.length > 0) {
            const { data: localData, error } = await supabase
                .from('bookings')
                .select('booking_id, admin_note, paid_at, source, is_promo')
                .in('booking_id', ids);

            if (error) {
                console.error('[Local DB Error]:', error);
            } else if (localData) {
                localData.forEach((row: any) => {
                    localDataMap[row.booking_id] = row;
                });
                console.log(`[Local DB] Found ${localData.length} related local records`);
            }
        }

        // 3. Merge Data
        const mergedBookings = matchdayBookings.map(booking => {
            const sid = String(booking.id);
            const local = localDataMap[sid] || {};

            return {
                ...booking,
                admin_note: local.admin_note || null,
                paid_at: local.paid_at || null,
                source: local.source || 'import', // Default to import if unknown
                is_promo: local.is_promo || false
            };
        });

        return new Response(JSON.stringify({ bookings: mergedBookings }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('[Critical Error]:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
