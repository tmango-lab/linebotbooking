
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
// Pricing Config (Updated from GAS/field_config.gs)
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

    // Apply Rounding Rule: Both Pre and Post prices round UP to nearest 100
    // Apply Rounding Rule: Both Pre and Post prices round UP to nearest 100
    // User Requirement: 1.5h = 750 -> 800
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

        // --- Helper for Update ---
        async function updateMatch(matchId: number, payload: any) {
            const updateUrl = `${MD_BASE_URL}/arena/match/${matchId}`;
            // Ensure payload has phone number if provided (Matchday expects 'tel' in update, 'phone_number' in settings for create)
            console.log(`[Auto-Correct] Update Payload for ${matchId}:`, JSON.stringify(payload));

            const updateRes = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Origin': 'https://arena.matchday.co.th'
                },
                body: JSON.stringify(payload)
            });
            if (!updateRes.ok) {
                console.error('Update failed:', await updateRes.text());
            } else {
                console.log('Update success');
            }
        }

        let data: any = {};
        let autoCorrected = false;
        if (mdText) {
            try {
                data = JSON.parse(mdText);

                // Auto-Correct Logic
                const createdMatch = data.match || (data.matches && data.matches[0]);
                let autoCorrected = false;

                // Check if we need to enforce price (if Matchday returned different price, or just to be safe)
                if (createdMatch && createdMatch.id) {
                    // Force update to sync Description (Name + Phone) even if price matches
                    // Add delay to prevent race condition with Matchday's internal creation helpers
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    if (price > 0) {
                        console.log(`[Auto-Correct] Enforcing price ${price} for match ${createdMatch.id}`);
                        await updateMatch(createdMatch.id, {
                            // Don't re-send times, it might cause timezone shifts or disappearance
                            // time_start: timeStartStr, 
                            // time_end: timeEndStr,

                            description: `${customerName} ${phoneNumber}`,
                            settings: {
                                name: customerName,
                                phone_number: phoneNumber,
                                note: note || ''
                            },
                            change_price: price
                        });
                        autoCorrected = true;
                    }
                }

            } catch (e) {
                console.warn('Matchday returned non-JSON response:', mdText);
            }
        }

        return new Response(JSON.stringify({ success: true, data, price, autoCorrected }), {
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
