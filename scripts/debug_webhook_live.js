
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/webhook';

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
                    userId: "Udebug1234567890" // Mock User
                },
                replyToken: "nHuyWiB7yP5Zv52FIkVlV55fko853eis" // Invalid token, but should trigger logic
            }
        ]
    };

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-line-signature': 'bypass'
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log('Response:', text);
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

testWebhook();
