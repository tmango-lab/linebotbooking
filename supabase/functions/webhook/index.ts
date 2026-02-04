// supabase/functions/webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifySignature } from "../_shared/lineClient.ts";
import { handleMessage, handlePostback, handleImage } from './handlers.ts';

const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') || '';

console.log("LINE Webhook Function Started");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await req.text();
        const signature = req.headers.get('x-line-signature') || '';

        console.log("Received Event:", body);

        // 1. Verify Signature
        if (!await verifySignature(body, signature, Deno.env.get('LINE_CHANNEL_SECRET') || '')) {
            console.error("Invalid Signature");
            return new Response('Invalid signature', { status: 401 });
        }

        // 2. Parse Events
        const { events } = JSON.parse(body);

        // 3. Process each event
        for (const event of events) {
            if (event.type === 'message') {
                if (event.message.type === 'text') {
                    await handleMessage(event);
                } else if (event.message.type === 'image') {
                    await handleImage(event);
                }
            } else if (event.type === 'postback') {
                await handlePostback(event);
            }
        }

        return new Response("OK", { status: 200 });

    } catch (err) {
        console.error("Webhook Error:", err);
        return new Response(`Error: ${err.message}`, { status: 500 });
    }
});
