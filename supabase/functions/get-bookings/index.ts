
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import { fetchMatchdayMatches } from "../_shared/matchdayApi.ts";

console.log("Get Bookings Function Started (Hybrid Data Source)");

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
        // We pass 0 as courtId to fetch ALL courts
        const matchdayBookings = await fetchMatchdayMatches(date, 0);
        console.log(`[Matchday] Retrieved ${matchdayBookings.length} records`);

        // 2. Fetch from Local Database (Source for Notes & Overrides)
        // We extract IDs to batch query
        const ids = matchdayBookings.map(b => String(b.id)); // Ensure ID is string for DB lookup

        let noteMap: Record<string, string> = {};

        if (ids.length > 0) {
            const { data: localData, error } = await supabase
                .from('bookings')
                .select('booking_id, admin_note')
                .in('booking_id', ids);

            if (error) {
                console.error('[Local DB Error]:', error);
                // We don't fail the request, just log and continue without notes
            } else if (localData) {
                localData.forEach((row: any) => {
                    if (row.admin_note) {
                        noteMap[row.booking_id] = row.admin_note;
                    }
                });
                console.log(`[Local DB] Found ${localData.length} related local records`);
            }
        }

        // 3. Merge Data
        const mergedBookings = matchdayBookings.map(booking => {
            const sid = String(booking.id);
            return {
                ...booking,
                admin_note: noteMap[sid] || null // Attach admin_note if exists
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
