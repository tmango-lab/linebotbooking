
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import { updateMatchdayBooking } from "../_shared/matchdayApi.ts";

console.log("Update Booking Function Started (With Payment Status)");

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { matchId, price, adminNote, timeStart, timeEnd, customerName, tel, isPaid, source } = await req.json();

        if (!matchId) throw new Error('Missing matchId');

        console.log(`[Update Booking] ID: ${matchId}, Price: ${price}, Paid: ${isPaid}`);

        // 1. Matchday Update
        let matchdayResult = null;
        if (price !== undefined && price !== null) {
            matchdayResult = await updateMatchdayBooking(matchId, {
                time_start: timeStart,
                time_end: timeEnd,
                description: (customerName && tel) ? `${customerName} ${tel}` : undefined,
                change_price: price,
                // @ts-ignore
                fixed_price: price,
                price: price
            });
        }

        // 2. Local DB Sync
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

        // Handle Payment Status
        if (isPaid !== undefined) {
            updatePayload.paid_at = isPaid ? new Date().toISOString() : null;
        }

        // Handle Source (Only if provided, and likely only on creation or explicit update)
        if (source !== undefined) {
            updatePayload.source = source;
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
            const { data, error } = await supabase
                .from('bookings')
                .update(updatePayload)
                .eq('booking_id', String(matchId))
                .select()
                .single();
            localData = data;
            localError = error;
        } else {
            // New Insert
            const insertPayload = {
                booking_id: String(matchId),
                user_id: 'MATCHDAY_IMPORT',
                status: 'confirmed',
                source: 'import', // Default for new unknown imports
                ...updatePayload
            };

            // If explicit source provided in payload, override
            if (source) insertPayload.source = source;

            const { data, error } = await supabase
                .from('bookings')
                .insert(insertPayload)
                .select()
                .single();
            localData = data;
            localError = error;
        }

        if (localError) throw new Error(`Local DB Update Failed: ${localError.message}`);

        return new Response(JSON.stringify({ success: true, matchday: matchdayResult, local: localData }), {
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
