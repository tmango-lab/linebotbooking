import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Broadcast Campaign Function Started");

serve(async (req) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { campaignId, targetTags } = await req.json();

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

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase configuration missing');
        }

        const campaignRes = await fetch(`${supabaseUrl}/rest/v1/campaigns?id=eq.${campaignId}`, {
            headers: {
                'apikey': supabaseKey,
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
        const walletUrl = `https://liff.line.me/${LIFF_ID}/wallet`;

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

        // Logic: Broadcast vs Multicast
        // If targetTags is provided and NOT empty or "All", we filter users.
        let targetUserIds: string[] = [];

        if (targetTags && Array.isArray(targetTags) && targetTags.length > 0 && !targetTags.includes('All')) {
            console.log(`[Broadcast] Targeting tags: ${targetTags.join(', ')}`);

            // Query profiles — user_id IS the LINE User ID (this system uses LINE Login as primary auth)
            const profilesRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=user_id,tags`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!profilesRes.ok) {
                const errText = await profilesRes.text();
                throw new Error(`Failed to fetch profiles: ${errText}`);
            }

            const profiles: any[] = await profilesRes.json();
            console.log(`[Broadcast] Fetched ${profiles.length} profiles from DB.`);

            // Filter users who have AT LEAST ONE of the target tags
            // Also skip non-LINE user IDs (manual_ prefix = admin-created entries without LINE)
            targetUserIds = profiles
                .filter((p: any) =>
                    p.tags &&
                    p.tags.some((t: string) => targetTags.includes(t)) &&
                    p.user_id &&
                    !p.user_id.startsWith('manual_')
                )
                .map((p: any) => p.user_id);

            console.log(`[Broadcast] Found ${targetUserIds.length} matching users with LINE IDs.`);

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

        if (targetUserIds.length > 0) {
            // MULTICAST (Chunked 500)
            const chunkSize = 500;
            const chunks: string[][] = [];
            for (let i = 0; i < targetUserIds.length; i += chunkSize) {
                chunks.push(targetUserIds.slice(i, i + chunkSize));
            }

            for (const chunk of chunks) {
                console.log(`[Multicast] Sending to ${chunk.length} users...`);
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

                if (!res.ok) {
                    const errBody = await res.text();
                    throw new Error(`LINE Multicast API Error (${res.status}): ${errBody}`);
                }
            }

            return new Response(JSON.stringify({
                success: true,
                message: "Broadcast sent successfully",
                result: { mode: 'multicast', count: targetUserIds.length }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else {
            // BROADCAST (To All Followers)
            const broadcastRes = await fetch("https://api.line.me/v2/bot/message/broadcast", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                },
                body: JSON.stringify({
                    messages: [flexMessage]
                })
            });

            if (!broadcastRes.ok) {
                const errorText = await broadcastRes.text();
                throw new Error(`LINE Broadcast API Error (${broadcastRes.status}): ${errorText}`);
            }

            return new Response(JSON.stringify({
                success: true,
                message: "Broadcast sent to all followers",
                result: { mode: 'broadcast' }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

    } catch (error: any) {
        console.error('[broadcast-campaign] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
