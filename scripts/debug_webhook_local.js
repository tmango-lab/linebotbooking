
import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:54321/functions/v1/webhook';

async function testWebhook() {
    console.log(`Sending mock event to ${WEBHOOK_URL}...`);

    const payload = {
        destination: "Uxxxxxxxxxxxx",
        events: [
            {
                type: "message",
                message: {
                    type: "text",
                    id: "12345",
                    text: "ป้าขาว"
                },
                timestamp: Date.now(),
                source: {
                    type: "user",
                    userId: "Udebug1234567890"
                },
                replyToken: "nHuyWiB7yP5Zv52FIkVlV55fko853eis"
            }
        ]
    };

    // Calculate Signature if needed, or bypass if running with --no-verify-jwt AND webhook logic allows skipping?
    // The webhook code calls `validateLinesignature`. If that fails, it returns 401.
    // I need to skip verification in code for local test OR mock a valid signature.
    // Local Supabase usually doesn't enforce signature headers unless my code does.
    // My code logic:
    /*
    const body = await req.text();
    if (!validateSignature(body, signature, channelSecret)) {
        return new Response('Invalid signature', { status: 401 });
    }
    */
    // I might need to temporarily bypass signature check in `index.ts` for debugging? 
    // Or I can generate a signature in this script using crypto.
    // Let's generate it!

    // ... wait, I need crypto. 
}
// Rewriting to include signature generation
