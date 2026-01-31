import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Broadcast Campaign Function Started");

serve(async (req) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { campaignId } = await req.json();

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

        // Construct Wallet URL
        const walletUrl = `${Deno.env.get("VITE_APP_URL") || "https://your-app.vercel.app"}/#/wallet`;

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

        // Send Broadcast via LINE Messaging API
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
            throw new Error(`LINE API Error: ${errorText}`);
        }

        const result = await broadcastRes.json();

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
