import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Update Booking Function Started (Anti-Gaming + Full Price Logic)");

// Field ID Mapping (Matchday court_id to local field_no)
const FIELD_MAP: Record<number, number> = {
    2424: 1, 2425: 2, 2428: 3, 2426: 4, 2427: 5, 2429: 6
};

// Pricing Config (Same as create-booking)
const PRICING = {
    1: { pre: 500, post: 700 },
    2: { pre: 500, post: 700 },
    3: { pre: 1000, post: 1200 },
    4: { pre: 800, post: 1000 },
    5: { pre: 800, post: 1000 },
    6: { pre: 1000, post: 1200 },
};

function calculatePrice(fieldNo: number, startTime: string, durationHours: number) {
    console.log(`[calculatePrice] Input: fieldNo=${fieldNo} (type: ${typeof fieldNo}), startTime=${startTime}, duration=${durationHours}h`);

    const prices = PRICING[fieldNo as keyof typeof PRICING];
    if (!prices) {
        console.log(`[calculatePrice] ERROR: No pricing found for fieldNo=${fieldNo}. Available fields: ${Object.keys(PRICING).join(', ')}`);
        return 0;
    }

    const [h, m] = startTime.split(':').map(Number);
    const startH = h + (m / 60);
    const endH = startH + durationHours;
    const cutOff = 18.0;

    let preHours = 0;
    let postHours = 0;

    if (endH <= cutOff) preHours = durationHours;
    else if (startH >= cutOff) postHours = durationHours;
    else {
        preHours = cutOff - startH;
        postHours = endH - cutOff;
    }

    let prePrice = preHours * prices.pre;
    let postPrice = postHours * prices.post;

    if (prePrice > 0 && prePrice % 100 !== 0) {
        prePrice = Math.ceil(prePrice / 100) * 100;
    }
    if (postPrice > 0 && postPrice % 100 !== 0) {
        postPrice = Math.ceil(postPrice / 100) * 100;
    }

    const total = Math.round(prePrice + postPrice);
    console.log(`[calculatePrice] Result: ${total} THB (pre: ${prePrice}, post: ${postPrice})`);
    return total;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        // Initialize Supabase Client
        // Use SERVICE_ROLE_KEY for admin operations (updating bookings requires admin privileges)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') || '';

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const { matchId, price, adminNote, timeStart, timeEnd, customerName, tel, isPaid, source, courtId } = await req.json();

        if (!matchId) throw new Error('Missing matchId');

        console.log(`[Update Booking] ID: ${matchId}, Price: ${price}, Paid: ${isPaid}, Court: ${courtId}`);

        // Parse Times
        let dateStr = null;
        let timeFrom = null;
        let timeTo = null;
        let durationMinutes = 0;

        if (timeStart && timeEnd) {
            // Fix: replaceAll to handle dates like "2026-02-01 01:00:00"
            const start = new Date(timeStart.replaceAll(' ', 'T'));
            const end = new Date(timeEnd.replaceAll(' ', 'T'));

            dateStr = timeStart.split(' ')[0];
            timeFrom = timeStart.split(' ')[1];
            timeTo = timeEnd.split(' ')[1];

            const diffMs = end.getTime() - start.getTime();
            durationMinutes = Math.round(diffMs / 60000);

            console.log(`[Parse Times] Start: ${start.toISOString()}, End: ${end.toISOString()}, Duration: ${durationMinutes}min`);
        }

        const updatePayload: any = {
            updated_at: new Date().toISOString(),
        };

        // NOTE: Price will be calculated later based on duration/field changes
        // Do NOT set price here - it will be overridden by Anti-Gaming logic if needed

        if (adminNote !== undefined) updatePayload.admin_note = adminNote;
        if (customerName !== undefined) updatePayload.display_name = customerName;
        if (tel !== undefined) updatePayload.phone_number = tel;

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
            .select('booking_id, price_total_thb, duration_h, field_no, time_from')
            .eq('booking_id', String(matchId))
            .single();

        let localData, localError;

        if (existing) {
            // --- Anti-Gaming Logic Start ---
            const oldPrice = Number(existing.price_total_thb || 0);
            const oldDuration = Number(existing.duration_h || 0);

            const newPrice = price !== undefined ? Number(price) : oldPrice;
            const newDuration = (timeStart && timeEnd) ? (durationMinutes / 60) : oldDuration;

            console.log(`[Anti-Gaming] Check: Price ${oldPrice}->${newPrice}, Duration ${oldDuration}->${newDuration}`);

            const isPriceDecreased = newPrice < oldPrice;
            const isDurationDecreased = newDuration < oldDuration - 0.01;

            let couponBurned = false;

            if (isDurationDecreased) {
                console.log(`[Anti-Gaming] Triggered! Releasing coupons for booking ${matchId}`);

                // Release User Coupons (V2)
                const { error: releaseError } = await supabase
                    .from('user_coupons')
                    .update({
                        status: 'ACTIVE',
                        booking_id: null,
                        used_at: null
                    })
                    .eq('booking_id', String(matchId))
                    .eq('status', 'used');

                if (releaseError) {
                    console.error('[Anti-Gaming] Failed to release coupons:', releaseError);
                } else {
                    console.log('[Anti-Gaming] Coupons released successfully.');
                }

                couponBurned = true;
            }

            // --- Anti-Gaming Logic (V1: Promo Codes) ---
            const { data: promo } = await supabase
                .from('promo_codes')
                .select('duration_h, status')
                .eq('booking_id', String(matchId))
                .single();

            if (promo && promo.status === 'used') {
                const originalDuration = Number(promo.duration_h || 0);

                if (newDuration < originalDuration - 0.01) {
                    console.log(`[Anti-Gaming V1] New Duration (${newDuration}) < Original (${originalDuration}). Burning to 'expired'.`);

                    const { error: releaseV1Error } = await supabase
                        .from('promo_codes')
                        .update({
                            status: 'expired',
                            booking_id: null,
                        })
                        .eq('booking_id', String(matchId));

                    if (releaseV1Error) console.error('[Anti-Gaming V1] Failed to burn promo:', releaseV1Error);
                    else console.log('[Anti-Gaming V1] Promo burned (expired) successfully.');

                    couponBurned = true;
                } else {
                    console.log(`[Anti-Gaming V1] New Duration (${newDuration}) >= Original (${originalDuration}). Safe (Revert Allowed).`);
                }
            }

            // --- CRITICAL: Recalculate Price Based on Changes ---
            // Always recalculate price when duration or field changes
            console.log(`[DEBUG] timeStart: ${timeStart}, timeEnd: ${timeEnd}`);
            console.log(`[DEBUG] isPriceDecreased: ${isPriceDecreased}, isDurationDecreased: ${isDurationDecreased}, couponBurned: ${couponBurned}`);

            if (timeStart && timeEnd) {
                const fieldNo = updatePayload.field_no || existing.field_no;
                const startTime = updatePayload.time_from || existing.time_from;
                const calculatedPrice = calculatePrice(fieldNo, startTime, newDuration);

                console.log(`[DEBUG] Calculated Price: ${calculatedPrice}, Provided Price: ${price}`);

                if (couponBurned || isDurationDecreased) {
                    // Coupon was burned OR duration decreased - charge FULL PRICE (no discount)
                    const reason = couponBurned ? 'Coupon Burned' : 'Duration Shrink';
                    console.log(`[Anti-Gaming] Charging full price: ${calculatedPrice} THB (Reason: ${reason})`);
                    updatePayload.price_total_thb = calculatedPrice;
                    updatePayload.is_promo = false;
                } else if (price !== undefined) {
                    // No anti-gaming trigger - use provided price (may include discount)
                    console.log(`[Price Update] Using provided price: ${price} THB (calculated would be: ${calculatedPrice})`);
                    updatePayload.price_total_thb = price;
                } else {
                    // No price provided - use calculated price
                    console.log(`[Price Update] Using calculated price: ${calculatedPrice} THB`);
                    updatePayload.price_total_thb = calculatedPrice;
                }
            } else if (price !== undefined) {
                // No time change - just update price if provided
                console.log(`[DEBUG] No time change, setting price to: ${price}`);
                updatePayload.price_total_thb = price;
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
            // Calculate price for new booking
            if (timeStart && timeEnd && !price) {
                const fieldNo = updatePayload.field_no || 1; // Default to field 1
                const startTime = updatePayload.time_from || '00:00:00';
                const calculatedPrice = calculatePrice(fieldNo, startTime, durationMinutes / 60);
                console.log(`[Create Booking] Calculated price: ${calculatedPrice} THB`);
                updatePayload.price_total_thb = calculatedPrice;
            } else if (price !== undefined) {
                updatePayload.price_total_thb = price;
            }

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
        console.error('[Update Booking Error Stack]:', error.stack);
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack,
            debug: "Function crashed - check logs"
        }), {
            status: 200, // CHANGED TO 200 FOR DEBUGGING
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
