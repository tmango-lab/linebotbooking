// @ts-nocheck
// supabase/functions/use-promo-code-and-book/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { promoCode, customerName, phoneNumber } = await req.json();

        if (!promoCode || !customerName || !phoneNumber) {
            return new Response(
                JSON.stringify({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Supabase client with service role to bypass RLS
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Step 1: Validate promo code
        const { data: promo, error: promoError } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', promoCode)
            .single();

        if (promoError || !promo) {
            return new Response(
                JSON.stringify({ error: 'ไม่พบโค้ดนี้ในระบบ' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check status
        if (promo.status !== 'active') {
            return new Response(
                JSON.stringify({ error: 'โค้ดนี้ไม่สามารถใช้งานได้แล้ว' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check expiry
        const now = new Date();
        const expiresAt = new Date(promo.expires_at);
        if (now > expiresAt) {
            return new Response(
                JSON.stringify({ error: 'โค้ดนี้หมดอายุแล้ว' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Step 2: Create booking in Matchday
        const matchdayToken = Deno.env.get('MATCHDAY_TOKEN');
        const matchdayUrl = 'https://arena.matchday-backend.com';

        if (!matchdayToken) {
            throw new Error('MATCHDAY_TOKEN not configured');
        }

        // Map internal field_id to Matchday court_id
        const FIELD_MAP: Record<number, number> = {
            1: 2424, // Field 1
            2: 2425, // Field 2
            3: 2428, // Field 3
            4: 2426, // Field 4
            5: 2427, // Field 5
            6: 2429, // Field 6
        };

        const matchdayCourtId = FIELD_MAP[promo.field_id];
        if (!matchdayCourtId) {
            return new Response(
                JSON.stringify({ error: `Invalid field_id: ${promo.field_id}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Extract HH:MM from time fields and add :01 for Matchday (23:00 -> 23:01)
        const timeFromHHMM = promo.time_from.substring(0, 5); // "23:00:00" -> "23:00"
        const timeToHHMM = promo.time_to.substring(0, 5);     // "24:00:00" -> "24:00"

        // Create booking
        const bookingPayload = {
            courts: [matchdayCourtId.toString()],
            time_start: `${promo.booking_date} ${timeFromHHMM}:00`,  // Use :00 like create-booking
            time_end: `${promo.booking_date} ${timeToHHMM}:00`,      // Use :00 for exact 1 hour
            settings: {
                name: customerName,
                phone_number: phoneNumber,
                note: `Promo: ${promoCode} | Price: ${promo.final_price}`
            },
            payment: 'cash',
            method: 'fast-create',
            payment_multi: false,
            fixed_price: null,  // [FIX] Prevent price lock, allow update later
            member_id: null,
            user_id: null
        };

        console.log('[DEBUG] Creating booking with payload:', bookingPayload);

        const bookingResponse = await fetch(`${matchdayUrl}/arena/create-match`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${matchdayToken}`,
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify(bookingPayload)
        });

        if (!bookingResponse.ok) {
            const errorText = await bookingResponse.text();
            console.error('[ERROR] Matchday booking failed:', errorText);

            // Check if it's a conflict (slot already booked)
            if (bookingResponse.status === 409 || errorText.includes('conflict')) {
                return new Response(
                    JSON.stringify({ error: 'สนามไม่ว่างแล้ว กรุณาตรวจสอบอีกครั้ง' }),
                    { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            throw new Error(`Matchday API error: ${errorText}`);
        }

        // Parse response - handle both JSON and text
        const responseText = await bookingResponse.text();
        console.log('[DEBUG] Matchday response text:', responseText);
        console.log('[DEBUG] Matchday response length:', responseText?.length);

        let booking: any = {};
        if (responseText) {
            try {
                booking = JSON.parse(responseText);
                console.log('[DEBUG] Parsed booking object:', JSON.stringify(booking, null, 2));
            } catch (e) {
                console.warn('[WARN] Matchday returned non-JSON response:', responseText);
                console.error('[ERROR] JSON parse error:', e);
                // If not JSON, treat as success with empty booking object
                booking = { success: true };
            }
        } else {
            console.error('[ERROR] Matchday returned empty response!');
        }

        console.log('[DEBUG] Final booking object:', JSON.stringify(booking, null, 2));

        // Check if Matchday returned errors
        if (booking.errors && booking.errors.length > 0) {
            const errorMessage = booking.errors.join(', ');
            console.error('[ERROR] Matchday booking failed with errors:', errorMessage);

            return new Response(
                JSON.stringify({
                    error: `ไม่สามารถจองได้: ${errorMessage}`,
                    details: booking
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Extract match ID for promo code update
        const createdMatch = booking.match || (booking.matches && booking.matches[0]);

        // Step 2.5: Auto-Correction - Force price update (same as create-booking)
        if (createdMatch && createdMatch.id) {
            console.log(`[Auto-Correct] Waiting 5 seconds before updating match ${createdMatch.id}...`);
            await new Promise(resolve => setTimeout(resolve, 5000));  // [FIX] Match create-booking delay

            console.log(`[Auto-Correct] Enforcing price ${promo.final_price} for match ${createdMatch.id}`);

            const updatePayload = {
                time_start: `${promo.booking_date} ${timeFromHHMM}:00`,  // [FIX] Required for recalculation
                time_end: `${promo.booking_date} ${timeToHHMM}:00`,      // [FIX] Required for recalculation
                description: `${customerName} ${phoneNumber}`,
                change_price: promo.final_price,  // Apply discount via change_price
                price: promo.final_price          // [FIX] Force base price update for total_price
            };

            const updateResponse = await fetch(`${matchdayUrl}/arena/match/${createdMatch.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${matchdayToken}`,
                    'Origin': 'https://arena.matchday.co.th'
                },
                body: JSON.stringify(updatePayload)
            });

            const updateResponseText = await updateResponse.text();
            console.log('[Auto-Correct] Update response status:', updateResponse.status);
            console.log('[Auto-Correct] Update response body:', updateResponseText);

            if (!updateResponse.ok) {
                console.error('[Auto-Correct] Update failed');
            } else {
                console.log('[Auto-Correct] Update success');
                // Try to parse response to see what Matchday returned
                try {
                    const updatedMatch = JSON.parse(updateResponseText);
                    console.log('[Auto-Correct] Updated match price:', updatedMatch.match?.total_price || updatedMatch.total_price);
                } catch (e) {
                    console.log('[Auto-Correct] Could not parse update response');
                }
            }
        }

        // Step 3: Mark promo code as used (only if booking succeeded)
        const { error: updateError } = await supabase
            .from('promo_codes')
            .update({
                status: 'used',
                used_at: new Date().toISOString(),
                used_by: 'admin', // TODO: Get actual admin user ID from auth
                booking_id: createdMatch?.id?.toString() || booking.id?.toString()
            })
            .eq('id', promo.id);

        if (updateError) {
            console.error('[ERROR] Failed to mark promo code as used:', updateError);
            // Don't fail the request, booking is already created
        }

        return new Response(
            JSON.stringify({
                success: true,
                booking: booking,
                promoCode: promo
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('Error using promo code:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'เกิดข้อผิดพลาดในการจอง' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
