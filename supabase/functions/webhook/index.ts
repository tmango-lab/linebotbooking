// supabase/functions/webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifySignature } from "../_shared/lineClient.ts";
import { handleMessage, handlePostback } from "./handlers.ts";

const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') || '';

console.log("LINE Webhook Function Started");

serve(async (req) => {
    try {
        const signature = req.headers.get("x-line-signature") || "";
        const body = await req.text();

        console.log("Received Event:", body);

        // 1. Verify Signature
        if (!(await verifySignature(body, signature, LINE_CHANNEL_SECRET))) {
            console.error("Invalid Signature");
            return new Response("Invalid signature", { status: 401 });
        }

        // 2. Parse Events
        const json = JSON.parse(body);
        const events = json.events || [];

        // 3. Process each event
        for (const event of events) {
            if (event.type === 'message') {
                await handleMessage(event);
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
