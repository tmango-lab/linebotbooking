
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { pushMessage } from "../_shared/lineClient.ts";
import { getCouponFlex } from "../_shared/flex_templates.ts";

console.log("Test Flex Function Started");

serve(async (req) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { userId } = await req.json();

        if (!userId) {
            throw new Error('Missing userId');
        }

        console.log(`Sending Test Flex to ${userId}`);

        // Create a dummy coupon payload
        const dummyCoupon = {
            name: "Welcome Discount",
            description: "Get 15% off your next booking over 1,000 THB.",
            code: "WELCOME15",
            expiresAt: "2026-12-31",
            imageUrl: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop"
        };

        const flexMsg = getCouponFlex(dummyCoupon);

        // Send Message
        await pushMessage(userId, flexMsg);

        return new Response(JSON.stringify({ success: true, message: "Flex message sent" }), {
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
