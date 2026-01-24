
// Test Exact Payload - Variant: fixed_price only
// Usage: node scripts/test_exact_payload.js

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV';
const FUNC_URL = `${SUPABASE_URL}/functions/v1/debug-price-update`;

// Match 1460357 is the one on 2026-04-03
const MATCH_ID = 1460357;
const TARGET_PRICE = 700;

async function run() {
    console.log(`--- Testing Payload on Match ${MATCH_ID} ---`);
    console.log(`Target Price: ${TARGET_PRICE}`);

    const payload = {
        matchId: MATCH_ID,
        rawPayload: {
            change_price: TARGET_PRICE
        }
    };

    console.log(`Invoking ${FUNC_URL} with:`, JSON.stringify(payload, null, 2));

    try {
        const res = await fetch(FUNC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('Function Error:', res.status, await res.text());
            return;
        }

        const data = await res.json();
        console.log('Function Response:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('✅ Update request sent successfully.');
            // Check if persistence worked?
            // We can run check_latest_booking.js after this.
        } else {
            console.error('❌ Update reported failure.');
        }

    } catch (err) {
        console.error('Exception:', err);
    }
}

run();
