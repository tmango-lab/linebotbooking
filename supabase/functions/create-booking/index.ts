
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Create Booking Function Started (Fully Inlined v2)");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
const token = Deno.env.get('MATCHDAY_TOKEN');
const MD_BASE_URL = 'https://arena.matchday-backend.com';

// Hardcoded Mapping for stability
const FIELD_MAP: Record<number, number> = {
    2424: 2424, // Field 1
    2425: 2425, // Field 2
    2428: 2428, // Field 3
    2426: 2426, // Field 4
    2427: 2427, // Field 5
    2429: 2429, // Field 6
};

// Pricing Config (same as Dashboard)
const PRICING = {
    2424: { pre: 600, post: 600 },
    2425: { pre: 600, post: 600 },
    2428: { pre: 900, post: 1100 },
    2426: { pre: 900, post: 1100 },
    2427: { pre: 900, post: 1100 },
    2429: { pre: 900, post: 1100 },
};

function calculatePrice(fieldId: number, startTime: string, durationHours: number) {
    const prices = PRICING[fieldId as keyof typeof PRICING];
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

    return Math.round((preHours * prices.pre) + (postHours * prices.post));
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

        const matchdayCourtId = FIELD_MAP[fieldId];
        if (!matchdayCourtId) {
            return new Response(JSON.stringify({ error: `Unknown Field ID: ${fieldId}` }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Calculate Duration
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        const durationH = (endMin - startMin) / 60;

        const price = calculatePrice(fieldId, startTime, durationH);
        console.log(`[Create Booking] Price: ${price}`);

        if (!token) {
            throw new Error('MATCHDAY_TOKEN is missing');
        }

        // Call Matchday API
        const url = `${MD_BASE_URL}/arena/create-match`;
        const timeStartStr = `${date} ${startTime}:00`;
        const timeEndStr = `${date} ${endTime}:00`;

        const body = {
            courts: [matchdayCourtId.toString()],
            time_start: timeStartStr,
            time_end: timeEndStr,
            settings: {
                name: customerName,
                phone_number: phoneNumber,
                note: note || ''
            },
            payment: 'cash',
            method: 'fast-create',
            payment_multi: false,
            fixed_price: price,
            member_id: null,
            user_id: null
        };

        console.log('[MATCHDAY BOOkING] Payload:', JSON.stringify(body));

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Matchday Create Error: ${res.status} - ${errorText}`);
            return new Response(JSON.stringify({ error: `Matchday API Error: ${errorText}` }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const mdText = await res.text();
        console.log('[Matchday Create Response]:', mdText);

        let data = {};
        if (mdText) {
            try {
                data = JSON.parse(mdText);
            } catch (e) {
                console.warn('Matchday returned non-JSON response:', mdText);
                // If it's 200 OK but text is not JSON, we might still consider it success if the API behavior is weird.
                // But usually create returns the created object.
            }
        }

        return new Response(JSON.stringify({ success: true, data, price }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[Create Booking Error]:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
