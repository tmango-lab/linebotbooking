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

        // Check Existence and Fetch Details for Anti-Gaming Logic
        const { data: existing, error: fetchError } = await supabase
            .from('bookings')
            .select('booking_id, price_total_thb, duration_h')
            .eq('booking_id', String(matchId))
            .single();

        if (fetchError || !existing) {
            // If not found, perhaps it's a new booking (handled below), but for update logic we expect it to exist if 'matchId' implies update.
            // However, the original code allowed creating if not exists.
            // If it's a NEW booking, anti-gaming doesn't apply (no previous coupon used).
        }

        let localData, localError;

        if (existing) {
            // --- Anti-Gaming Logic Start ---
            // Determine Old Values
            const oldPrice = Number(existing.price_total_thb || 0);
            const oldDuration = Number(existing.duration_h || 0);

            // Determine New Values
            // If price is in payload, use it; otherwise use old.
            const newPrice = price !== undefined ? Number(price) : oldPrice;

            // If time is in payload, usage `durationMinutes/60`; otherwise use old.
            // Note: durationMinutes is calculated above if timeStart/timeEnd exist.
            const newDuration = (timeStart && timeEnd) ? (durationMinutes / 60) : oldDuration;

            console.log(`[Anti-Gaming] Check: Price ${oldPrice}->${newPrice}, Duration ${oldDuration}->${newDuration}`);

            // Kick Condition: Price Decreased OR Duration Decreased
            // We use a small epsilon for float comparison just in case, or direct comparison.
            const isPriceDecreased = newPrice < oldPrice;
            const isDurationDecreased = newDuration < oldDuration - 0.01; // tolerance for float

            if (isPriceDecreased || isDurationDecreased) {
                console.log(`[Anti-Gaming] Triggered! Releasing coupons for booking ${matchId}`);

                // Release Coupons
                const { error: releaseError } = await supabase
                    .from('user_coupons')
                    .update({
                        status: 'ACTIVE',
                        booking_id: null,
                        used_at: null
                    })
                    .eq('booking_id', String(matchId))
                    .eq('status', 'USED');

                if (releaseError) {
                    console.error('[Anti-Gaming] Failed to release coupons:', releaseError);
                } else {
                    console.log('[Anti-Gaming] Coupons released successfully.');
                }
            }

            // --- Anti-Gaming Logic (V1: Promo Codes) ---
            // Fair Policy: Compare with ORIGINAL Promo Duration
            const { data: promo } = await supabase
                .from('promo_codes')
                .select('duration_h, status')
                .eq('booking_id', String(matchId))
                .single();

            // Only proceed if there is an active/used promo to check
            if (promo && promo.status === 'USED') {
                const originalDuration = Number(promo.duration_h || 0);

                // Check ONLY Duration for V1 Fair Policy (Price check is secondary or covered by duration usually)
                // Logic: If New Duration is LESS than Original Commitment -> BURN
                if (newDuration < originalDuration - 0.01) {
                    console.log(`[Anti-Gaming V1] New Duration (${newDuration}) < Original (${originalDuration}). Burning.`);

                    const { error: releaseV1Error } = await supabase
                        .from('promo_codes')
                        .update({
                            status: 'burned',
                            booking_id: null,
                        })
                        .eq('booking_id', String(matchId));

                    if (releaseV1Error) console.error('[Anti-Gaming V1] Failed to burn promo:', releaseV1Error);
                    else console.log('[Anti-Gaming V1] Promo burned successfully.');

                } else {
                    console.log(`[Anti-Gaming V1] New Duration (${newDuration}) >= Original (${originalDuration}). Safe (Revert Allowed).`);
                }
            } else if (isPriceDecreased || isDurationDecreased) {
                // Fallback: If no V1 promo found (maybe V2?), or just logging
                // For now, V2 logic is separate (above). This block effectively does nothing for non-V1.
            }
            // --- Anti-Gaming Logic End ---

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
