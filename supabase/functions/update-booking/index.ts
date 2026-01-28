import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";

console.log("Update Booking Function Started (Local DB Only)");

// Field ID Mapping (Matchday court_id to local field_no)
const FIELD_MAP: Record<number, number> = {
    2424: 1, 2425: 2, 2428: 3, 2426: 4, 2427: 5, 2429: 6
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { matchId, price, adminNote, timeStart, timeEnd, customerName, tel, isPaid, source, courtId } = await req.json();

        if (!matchId) throw new Error('Missing matchId');

        console.log(`[Update Booking] ID: ${matchId}, Price: ${price}, Paid: ${isPaid}, Court: ${courtId}`);

        // Parse Times
        let dateStr = null;
        let timeFrom = null;
        let timeTo = null;
        let durationMinutes = 0;

        if (timeStart && timeEnd) {
            const start = new Date(timeStart.replace(' ', 'T'));
            const end = new Date(timeEnd.replace(' ', 'T'));

            dateStr = timeStart.split(' ')[0];
            timeFrom = timeStart.split(' ')[1];
            timeTo = timeEnd.split(' ')[1];

            const diffMs = end.getTime() - start.getTime();
            durationMinutes = Math.round(diffMs / 60000);
        }

        const updatePayload: any = {
            updated_at: new Date().toISOString(),
        };

        if (price !== undefined) updatePayload.price_total_thb = price;
        if (adminNote !== undefined) updatePayload.admin_note = adminNote;
        if (customerName !== undefined) updatePayload.display_name = customerName;
        if (tel !== undefined) {
            updatePayload.phone_number = tel;
            console.log(`[Update Booking] Updating phone_number to: ${tel}`);
        } else {
            console.log(`[Update Booking] No tel provided in payload`);
        }

        // Handle Payment Status
        if (isPaid !== undefined) {
            updatePayload.paid_at = isPaid ? new Date().toISOString() : null;
        }

        // Handle Source
        if (source !== undefined) {
            updatePayload.source = source;
        }

        // Handle Court Move (map Matchday court_id to local field_no)
        if (courtId !== undefined) {
            const fieldNo = FIELD_MAP[courtId] || courtId;
            updatePayload.field_no = fieldNo;
            console.log(`[Move Court] Updating field_no to ${fieldNo} (from courtId ${courtId})`);
        }

        if (dateStr) {
            updatePayload.date = dateStr;
            updatePayload.time_from = timeFrom;
            updatePayload.time_to = timeTo;
            updatePayload.duration_h = durationMinutes / 60;
        }

        // Check Existence
        const { data: existing } = await supabase
            .from('bookings')
            .select('booking_id')
            .eq('booking_id', String(matchId))
            .single();

        let localData, localError;

        if (existing) {
            // Update existing booking
            const { data, error } = await supabase
                .from('bookings')
                .update(updatePayload)
                .eq('booking_id', String(matchId))
                .select()
                .single();
            localData = data;
            localError = error;
        } else {
            // Create new booking if not exists
            const insertPayload = {
                booking_id: String(matchId),
                user_id: 'admin',
                status: 'confirmed',
                source: source || 'admin',
                ...updatePayload
            };

            const { data, error } = await supabase
                .from('bookings')
                .insert(insertPayload)
                .select()
                .single();
            localData = data;
            localError = error;
        }

        if (localError) throw new Error(`Local DB Update Failed: ${localError.message}`);

        console.log(`[Update Booking] Success: ${matchId}`);

        return new Response(JSON.stringify({ success: true, booking: localData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Update Booking Error]:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
