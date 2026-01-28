
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";

console.log("Create Booking Function Started (Local DB Only)");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Field ID Mapping (Matchday court_id to local field_no)
const FIELD_MAP: Record<number, number> = {
    2424: 1, // Field 1
    2425: 2, // Field 2
    2428: 3, // Field 3
    2426: 4, // Field 4
    2427: 5, // Field 5
    2429: 6, // Field 6
};

// Pricing Config
const PRICING = {
    1: { pre: 500, post: 700 },  // Field 1
    2: { pre: 500, post: 700 },  // Field 2
    3: { pre: 1000, post: 1200 }, // Field 3
    4: { pre: 800, post: 1000 },  // Field 4
    5: { pre: 800, post: 1000 },  // Field 5
    6: { pre: 1000, post: 1200 }, // Field 6
};

function calculatePrice(fieldNo: number, startTime: string, durationHours: number) {
    const prices = PRICING[fieldNo as keyof typeof PRICING];
    if (!prices) return 0;

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

    return Math.round(prePrice + postPrice);
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { fieldId, date, startTime, endTime, customerName, phoneNumber, note } = await req.json();

        if (!fieldId || !date || !startTime || !endTime || !customerName || !phoneNumber) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Create Booking] Received: F${fieldId} on ${date} ${startTime}-${endTime}`);

        // Map Matchday court_id to local field_no
        const fieldNo = FIELD_MAP[fieldId] || fieldId;

        // Calculate Duration
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        const durationH = (endMin - startMin) / 60;

        const price = calculatePrice(fieldNo, startTime, durationH);
        console.log(`[Create Booking] Field: ${fieldNo}, Price: ${price}`);

        // Create booking in Local DB
        const { data: booking, error: insertError } = await supabase
            .from('bookings')
            .insert({
                user_id: 'admin', // Admin created booking
                booking_id: Date.now().toString(), // Generate numeric ID for compatibility
                field_no: fieldNo,
                status: 'confirmed',
                date: date,
                time_from: startTime,
                time_to: endTime,
                duration_h: durationH,
                price_total_thb: price,
                display_name: customerName,
                phone_number: phoneNumber,
                admin_note: note || null,
                source: 'admin',
                is_promo: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('[Create Booking Error]:', insertError);
            return new Response(JSON.stringify({ error: insertError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Create Booking] Success: ID ${booking.booking_id}`);

        return new Response(JSON.stringify({
            success: true,
            booking: {
                id: booking.booking_id,
                field_no: booking.field_no,
                date: booking.date,
                time_from: booking.time_from,
                time_to: booking.time_to,
                price: booking.price_total_thb,
                customer_name: booking.display_name,
                phone_number: booking.phone_number
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Create Booking Error]:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
