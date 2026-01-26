
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts"; // Use shared client

console.log("Create Booking Function Started (With Local Sync)");

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

// Pricing Config
const PRICING = {
    2424: { pre: 500, post: 700 },  // Field 1
    2425: { pre: 500, post: 700 },  // Field 2
    2428: { pre: 1000, post: 1200 }, // Field 3
    2426: { pre: 800, post: 1000 },  // Field 4
    2427: { pre: 800, post: 1000 },  // Field 5
    2429: { pre: 1000, post: 1200 }, // Field 6
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
            fixed_price: null,
            member_id: null,
            user_id: null
        };

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

        let data: any = {};
        let autoCorrected = false;
        let updateResult: any = null;
        let createdMatchId = null;

        if (mdText) {
            try {
                data = JSON.parse(mdText);
                const createdMatch = data.match || (data.matches && data.matches[0]);

                if (createdMatch && createdMatch.id) {
                    createdMatchId = createdMatch.id;

                    // --- 1. Insert into Local DB (Sync Source) ---
                    console.log(`[Local Sync] Inserting match ${createdMatch.id} as source='admin'`);
                    const { error: insertError } = await supabase
                        .from('bookings')
                        .insert({
                            booking_id: String(createdMatch.id),
                            user_id: 'MATCHDAY_IMPORT', // Or specific admin ID/Name if available
                            status: 'confirmed',
                            booking_date: date, // Deprecated col? Use date
                            date: date,
                            time_from: startTime,
                            time_to: endTime,
                            duration_h: durationH,
                            price_total_thb: price,
                            source: 'admin',
                            is_promo: false,
                            updated_at: new Date().toISOString()
                        });

                    if (insertError) {
                        console.error('[Local Sync Error]:', insertError);
                        // Non-blocking
                    }

                    // --- 2. Auto-Correct Price on Matchday ---
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    if (price > 0) {
                        const updateUrl = `${MD_BASE_URL}/arena/match/${createdMatch.id}`;
                        console.log(`[Auto-Correct] Updating price to ${price}`);

                        const updateRes = await fetch(updateUrl, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                                'Origin': 'https://arena.matchday.co.th'
                            },
                            body: JSON.stringify({
                                time_start: timeStartStr,
                                time_end: timeEndStr,
                                description: `${customerName} ${phoneNumber}`,
                                change_price: price,
                                price: price
                            })
                        });

                        const updateText = await updateRes.text();
                        if (updateRes.ok) {
                            autoCorrected = true;
                            updateResult = updateText;
                        } else {
                            console.error('[Auto-Correct] Failed:', updateText);
                        }
                    }
                }
            } catch (e) {
                console.warn('Matchday response parsing error:', e);
            }
        }

        return new Response(JSON.stringify({ success: true, data, price, autoCorrected, updateResult }), {
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
