
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
const token = Deno.env.get('MATCHDAY_TOKEN');
const MD_BASE_URL = 'https://arena.matchday-backend.com';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { matchId, price, fieldToTest, rawPayload } = await req.json();

        if (!matchId) {
            throw new Error('Missing matchId');
        }

        console.log(`Testing Update for Match ${matchId}`);

        const updateUrl = `${MD_BASE_URL}/arena/match/${matchId}`;

        let payload: any = {};

        if (rawPayload) {
            console.log('Using Raw Payload override:', JSON.stringify(rawPayload));
            payload = rawPayload;
        } else if (price) {
            console.log(`Using field '${fieldToTest}' with price ${price}`);
            if (fieldToTest === 'change_price') payload.change_price = price;
            else if (fieldToTest === 'fixed_price') payload.fixed_price = price;
            else if (fieldToTest === 'price') payload.price = price;
            else if (fieldToTest === 'all') {
                payload.change_price = price;
                payload.fixed_price = price;
            }
        } else {
            throw new Error('Must provide either price or rawPayload');
        }

        // Send PUT request to Matchday
        const res = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log('Update Response:', text);

        return new Response(JSON.stringify({
            success: res.ok,
            payloadSent: payload,
            response: text
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
