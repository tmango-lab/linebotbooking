
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const WEBHOOK_URL = 'http://localhost:54321/functions/v1/webhook';

async function testSlipWebhook() {
    console.log("🔍 Finding latest booking with status 'pending_payment'...");

    const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !booking) {
        console.error("❌ No pending booking found. Please create a booking with 'QR PromtPay' first.");
        return;
    }

    console.log(`✅ Found Booking ID: ${booking.booking_id} for User: ${booking.user_id}`);
    console.log(`🚀 Sending mock Image Ticket to ${WEBHOOK_URL}...`);

    const payload = {
        destination: "Uxxxxxxxxxxxx",
        events: [
            {
                type: "message",
                message: {
                    type: "image",
                    id: "MOCK_MSG_ID_" + Date.now()
                },
                timestamp: Date.now(),
                source: {
                    type: "user",
                    userId: booking.user_id
                },
                replyToken: "nHuyWiB7yP5Zv52FIkVlV55fko853eis"
            }
        ]
    };

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'X-Line-Signature': '...' // Signature check is usually disabled or bypassed in local dev
            },
            body: JSON.stringify(payload)
        });

        const result = await res.text();
        console.log(`📡 Response Status: ${res.status}`);
        console.log(`💬 Response Body: ${result}`);

        if (res.ok) {
            console.log("\n🎉 Webhook triggered successfully!");
            console.log("💡 Check your Supabase Edge Function logs to see the processing (handleImage).");
            console.log("💡 Note: getMessageContent will fail in local dev unless mock bytes are returned.");
        }
    } catch (err) {
        console.error("🔥 Error calling webhook:", err.message);
    }
}

testSlipWebhook();
