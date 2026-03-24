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
        const { mode, messages, userIds, excludeUserIds } = body;

        // Validate
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error('messages array is required and must not be empty');
        }
        if (messages.length > 5) {
            throw new Error('LINE API allows max 5 messages per request');
        }

        const authHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
        };

        let resultInfo: any;

        if (mode === 'multicast') {
            // ── Multicast: send to specific user IDs (chunked 500 at a time) ──
            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                throw new Error('userIds array is required for multicast mode');
            }

            const chunkSize = 500;
            const results: any[] = [];

            for (let i = 0; i < userIds.length; i += chunkSize) {
                const chunk = userIds.slice(i, i + chunkSize);
                const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify({ to: chunk, messages })
                });

                const resBody = await res.text();
                results.push({ chunk: i / chunkSize + 1, status: res.status, body: resBody });

                if (!res.ok) {
                    throw new Error(`LINE Multicast Error (chunk ${i / chunkSize + 1}): ${resBody}`);
                }
            }

            resultInfo = { mode: 'multicast', totalUsers: userIds.length, chunks: results };

        } else if (mode === 'narrowcast_exclude') {
            // ── Narrowcast with Exclusion ──
            // Step 1: Upload an audience group of users to EXCLUDE
            let audienceGroupId: number | null = null;

            if (excludeUserIds && Array.isArray(excludeUserIds) && excludeUserIds.length > 0) {
                const uploadRes = await fetch("https://api.line.me/v2/bot/audienceGroup/upload", {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify({
                        description: `Broadcast Exclude ${new Date().toISOString()}`,
                        isIfaAudience: false,
                        audiences: excludeUserIds.map((uid: string) => ({ id: uid }))
                    })
                });

                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) {
                    throw new Error(`LINE Audience Upload Error: ${JSON.stringify(uploadData)}`);
                }
                audienceGroupId = uploadData.audienceGroupId;
                console.log(`[Narrowcast] Uploaded exclude audience: ${audienceGroupId} (${excludeUserIds.length} users)`);

                // Polling to wait for audience group to be READY
                let isReady = false;
                for (let attempt = 0; attempt < 10; attempt++) {
                    // Wait 2 seconds before checking
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const statusRes = await fetch(`https://api.line.me/v2/bot/audienceGroup/${audienceGroupId}`, {
                        method: "GET",
                        headers: authHeaders
                    });
                    
                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        console.log(`[Narrowcast] Audience ${audienceGroupId} status: ${statusData.status}`);
                        if (statusData.status === 'READY') {
                            isReady = true;
                            break;
                        } else if (statusData.status === 'FAILED' || statusData.status === 'EXPIRED') {
                            throw new Error(`Audience group failed to process. Status: ${statusData.status}`);
                        }
                    }
                }

                if (!isReady) {
                    throw new Error(`Audience group ${audienceGroupId} is not ready after 20 seconds. Please try again.`);
                }
            }

            // Step 2: Send Narrowcast (with NOT exclusion if we have an audience group)
            const narrowcastBody: any = {
                messages,
                notificationDisabled: false
            };

            if (audienceGroupId) {
                narrowcastBody.recipient = {
                    type: "operator",
                    not: {
                        type: "audience",
                        audienceGroupId
                    }
                };
            }

            const narrowcastRes = await fetch("https://api.line.me/v2/bot/message/narrowcast", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify(narrowcastBody)
            });

            const narrowcastText = await narrowcastRes.text();
            if (!narrowcastRes.ok) {
                throw new Error(`LINE Narrowcast Error: ${narrowcastText}`);
            }

            resultInfo = {
                mode: 'narrowcast_exclude',
                excludedUsers: excludeUserIds?.length || 0,
                audienceGroupId,
                status: narrowcastRes.status
            };

        } else {
            // ── Broadcast: send to ALL followers ──
            const lineRes = await fetch("https://api.line.me/v2/bot/message/broadcast", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ messages })
            });

            const resText = await lineRes.text();
            if (!lineRes.ok) {
                throw new Error(`LINE Broadcast Error: ${resText}`);
            }

            resultInfo = { mode: 'broadcast', status: lineRes.status, body: resText };
        }

        console.log(`[Send Broadcast] Success:`, JSON.stringify(resultInfo));

        const successMessage =
            mode === 'multicast'
                ? `ส่ง Multicast สำเร็จ ถึง ${userIds?.length || 0} คน`
                : mode === 'narrowcast_exclude'
                ? `ส่ง Narrowcast สำเร็จ (ยกเว้น ${excludeUserIds?.length || 0} คน)`
                : 'ส่ง Broadcast สำเร็จ ถึงผู้ติดตามทุกคน';

        return new Response(JSON.stringify({
            success: true,
            message: successMessage,
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
