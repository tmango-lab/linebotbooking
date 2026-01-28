
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";

console.log("Get Bookings Function Started (Local Database v4 - Admin)");

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

        // Fetch from Local Database (Single Source of Truth)
        // Using Service Role Key for admin access (bypasses RLS)
        const { data: localBookings, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('date', date)
            .neq('status', 'cancelled') // Exclude cancelled bookings
            .order('time_from');

        if (error) {
            console.error('[Database Error]:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Database] Retrieved ${localBookings?.length || 0} records`);

        // Map field_no back to court_id for frontend compatibility
        const fieldToCourtMap: Record<number, number> = {
            1: 2424, // สนาม #1
            2: 2425, // สนาม #2
            3: 2428, // สนาม #3
            4: 2426, // สนาม #4
            5: 2427, // สนาม #5
            6: 2429  // สนาม #6
        };

        // Transform to match Matchday API format for frontend compatibility
        const bookings = (localBookings || []).map(b => ({
            id: parseInt(b.booking_id),
            court_id: fieldToCourtMap[b.field_no] || b.field_no,
            time_start: `${b.date} ${b.time_from}`,
            time_end: `${b.date} ${b.time_to}`,
            name: b.display_name || '',
            tel: b.phone_number || '', // Map phone_number to tel
            description: b.display_name || '',
            price: b.price_total_thb,
            total_price: b.price_total_thb,
            cancel: b.status === 'cancelled' ? 1 : 0,
            admin_note: b.admin_note || null,
            paid_at: b.paid_at || null,
            source: b.source || 'admin',
            is_promo: b.is_promo || false
        }));

        return new Response(JSON.stringify({ bookings }), {
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
