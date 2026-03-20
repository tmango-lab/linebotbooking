import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Send Broadcast Function Started");

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
        if (!LINE_CHANNEL_ACCESS_TOKEN) {
            throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
        }

        const body = await req.json();
        const { mode, messages, userIds } = body;

        // Validate
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error('messages array is required and must not be empty');
        }
        if (messages.length > 5) {
            throw new Error('LINE API allows max 5 messages per request');
        }

        let lineRes: Response;
        let resultInfo: any;

        if (mode === 'multicast') {
            // Multicast: send to specific user IDs (chunked 500 at a time)
            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                throw new Error('userIds array is required for multicast mode');
            }

            const chunkSize = 500;
            const results: any[] = [];

            for (let i = 0; i < userIds.length; i += chunkSize) {
                const chunk = userIds.slice(i, i + chunkSize);
                const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                    },
                    body: JSON.stringify({ to: chunk, messages })
                });

                const resBody = await res.text();
                results.push({ chunk: i / chunkSize + 1, status: res.status, body: resBody });

                if (!res.ok) {
                    throw new Error(`LINE Multicast Error (chunk ${i / chunkSize + 1}): ${resBody}`);
                }
            }

            resultInfo = { mode: 'multicast', totalUsers: userIds.length, chunks: results };

        } else {
            // Broadcast: send to ALL followers
            lineRes = await fetch("https://api.line.me/v2/bot/message/broadcast", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                },
                body: JSON.stringify({ messages })
            });

            const resText = await lineRes.text();
            if (!lineRes.ok) {
                throw new Error(`LINE Broadcast Error: ${resText}`);
            }

            resultInfo = { mode: 'broadcast', status: lineRes.status, body: resText };
        }

        console.log(`[Send Broadcast] Success:`, JSON.stringify(resultInfo));

        return new Response(JSON.stringify({
            success: true,
            message: mode === 'multicast'
                ? `ส่ง Multicast สำเร็จ ถึง ${userIds?.length || 0} คน`
                : 'ส่ง Broadcast สำเร็จ ถึงผู้ติดตามทุกคน',
            result: resultInfo
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Send Broadcast Error]:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
