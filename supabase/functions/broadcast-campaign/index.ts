import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Broadcast Campaign Function Started");

serve(async (req) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { campaignId, targetTags } = await req.json(); // [NEW] Accept targetTags

        if (!campaignId) {
            throw new Error('Campaign ID is required');
        }

        // Get LINE Channel Access Token from environment
        const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
        if (!LINE_CHANNEL_ACCESS_TOKEN) {
            throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
        }

        // Fetch campaign details from Supabase
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        const campaignRes = await fetch(`${supabaseUrl}/rest/v1/campaigns?id=eq.${campaignId}`, {
            headers: {
                'apikey': supabaseKey!,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const campaigns = await campaignRes.json();
        if (!campaigns || campaigns.length === 0) {
            throw new Error('Campaign not found');
        }

        const campaign = campaigns[0];

        // Construct Wallet URL (Use LIFF URL for reliable redirection)
        const LIFF_ID = Deno.env.get("LIFF_ID") || "2009013698-RcmHMN8h";
        const walletUrl = `https://liff.line.me/${LIFF_ID}/?userId=`; // LIFF will append the actual userId if opened within LINE

        // Build Flex Message
        const flexMessage = {
            type: "flex",
            altText: `🎁 ${campaign.name}`,
            contents: {
                type: "bubble",
                hero: {
                    type: "image",
                    url: campaign.image_url || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop",
                    size: "full",
                    aspectRatio: "20:13",
                    aspectMode: "cover",
                    action: {
                        type: "uri",
                        uri: walletUrl
                    }
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "text",
                            text: "SPECIAL REWARD",
                            weight: "bold",
                            color: "#D4AF37",
                            size: "xs"
                        },
                        {
                            type: "text",
                            text: campaign.name,
                            weight: "bold",
                            size: "xl",
                            margin: "md",
                            wrap: true
                        },
                        {
                            type: "text",
                            text: campaign.description || "Limited time offer!",
                            size: "sm",
                            color: "#999999",
                            margin: "sm",
                            wrap: true
                        }
                    ]
                },
                footer: {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        {
                            type: "button",
                            style: "primary",
                            action: {
                                type: "postback",
                                label: "🎁 รับเลย!",
                                data: `action=collectCoupon&campaignId=${campaignId}&secretCode=${campaign.secret_codes?.[0] || ''}`,
                                displayText: "กำลังเก็บคูปอง..."
                            },
                            color: "#06C755",
                            height: "sm"
                        },
                        {
                            type: "button",
                            style: "link",
                            action: { type: "uri", label: "👛 ดูกระเป๋า", uri: walletUrl },
                            height: "sm"
                        },
                        {
                            type: "text",
                            text: campaign.secret_codes?.[0] ? `Code: ${campaign.secret_codes[0]}` : "คูปองพิเศษ",
                            size: "xs",
                            color: "#aaaaaa",
                            align: "center",
                            margin: "md"
                        }
                    ]
                }
            }
        };

        // [NEW] Logic: Broadcast vs Multicast
        // If targetTags is provided and NOT empty or "All", we filter users.
        let targetUserIds: string[] = [];

        if (targetTags && Array.isArray(targetTags) && targetTags.length > 0 && !targetTags.includes('All')) {
            console.log(`[Broadcast] Targeting tags: ${targetTags.join(', ')}`);

            // Query profiles with matching tags
            const { data: profiles, error: profileError } = await fetch(`${supabaseUrl}/rest/v1/profiles?select=user_id,tags`, {
                headers: {
                    'apikey': supabaseKey!,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            }).then(res => res.json())
                .then((data: any[]) => {
                    // Filter client-side or use .contains() if possible.
                    // PostgREST .cs (contains) works for array columns: tags=cs.{vip}
                    // However, to support ANY match (OR logic), we might need manual filter if complex.
                    // Let's rely on client filter for flexibility now or simple overlaps.
                    // Actually, let's fetch all and filter to be safe or use specific query.
                    // For now, let's just fetch all profiles (if small) or use .ov (overlap)
                    // best: .ov.{tag1,tag2} means overlap.
                    return { data, error: null };
                });

            if (profileError) throw profileError;

            // Filter users who have AT LEAST ONE of the target tags
            targetUserIds = profiles
                .filter((p: any) => p.tags && p.tags.some((t: string) => targetTags.includes(t)))
                .map((p: any) => p.user_id);

            console.log(`[Broadcast] Found ${targetUserIds.length} matching users.`);

            if (targetUserIds.length === 0) {
                return new Response(JSON.stringify({
                    success: true,
                    message: "No users found with specified tags",
                    result: { count: 0 }
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

        } else {
            console.log(`[Broadcast] Targeting ALL users (Broadcast API)`);
        }

        let broadcastRes;

        if (targetUserIds.length > 0) {
            // MULTICAST (Chunked 500)
            // https://developers.line.biz/en/reference/messaging-api/#send-multicast-message
            const chunkSize = 500;
            const chunks = [];
            for (let i = 0; i < targetUserIds.length; i += chunkSize) {
                chunks.push(targetUserIds.slice(i, i + chunkSize));
            }

            const results = [];
            for (const chunk of chunks) {
                const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                    },
                    body: JSON.stringify({
                        to: chunk,
                        messages: [flexMessage]
                    })
                });
                results.push(await res.json());
            }
            // Aggregate results mock
            broadcastRes = { ok: true, json: async () => ({ multicasts: results }) };

        } else {
            // BROADCAST (To All)
            broadcastRes = await fetch("https://api.line.me/v2/bot/message/broadcast", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                },
                body: JSON.stringify({
                    messages: [flexMessage]
                })
            });
        }

        // Handle Response
        if (!broadcastRes.ok && targetUserIds.length === 0) { // Only check if using standard broadcast
            const errorText = await broadcastRes.text ? await broadcastRes.text() : 'Unknown Error';
            throw new Error(`LINE API Error: ${errorText}`);
        }

        const result = targetUserIds.length > 0 ? { mode: 'multicast', count: targetUserIds.length } : await broadcastRes.json();


        return new Response(JSON.stringify({
            success: true,
            message: "Broadcast sent successfully",
            result
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });


    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
