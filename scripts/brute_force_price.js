
// Brute Force Price Update
// Usage: node scripts/brute_force_price.js

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV';
const FUNC_URL = `${SUPABASE_URL}/functions/v1/debug-price-update`;
const BOOKING_URL = `${SUPABASE_URL}/functions/v1/get-bookings`;

const DATE = '2026-04-03';
const MATCH_ID = 1460357;
const TARGET_PRICE = 700;

const PAYLOADS = [
    { name: 'fixed_price_only', payload: { fixed_price: TARGET_PRICE } },
    { name: 'change_price_only', payload: { change_price: TARGET_PRICE } },
    { name: 'price_only', payload: { price: TARGET_PRICE } },
    { name: 'all_root', payload: { fixed_price: TARGET_PRICE, change_price: TARGET_PRICE, price: TARGET_PRICE } },
    { name: 'settings_fixed', payload: { settings: { fixed_price: TARGET_PRICE } } },
    { name: 'settings_price', payload: { settings: { price: TARGET_PRICE } } },
    { name: 'grand_total', payload: { grand_total: TARGET_PRICE } },
    { name: 'total_price', payload: { total_price: TARGET_PRICE } }
];

async function checkBooking() {
    try {
        const res = await fetch(BOOKING_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({ date: DATE })
        });
        const data = await res.json();
        const booking = data.bookings?.find(b => b.id === MATCH_ID);
        return booking ? booking.total_price : -1;
    } catch (e) { return -1; }
}

async function run() {
    console.log(`--- BRUTE FORCE PRICE UPDATE ---`);
    console.log(`Target: Match ${MATCH_ID} -> 700 THB`);

    let currentPrice = await checkBooking();
    console.log(`Initial Total Price: ${currentPrice}`);

    if (currentPrice === TARGET_PRICE) {
        console.log("Already 700! Resetting to 600 to test...");
        // Reset logic here if implemented, or manually reset via change_price: 600 first?
        // Let's assume it's 600.
    }

    for (const test of PAYLOADS) {
        console.log(`\nTesting: ${test.name}`);
        console.log(`Payload:`, JSON.stringify(test.payload));

        const body = {
            matchId: MATCH_ID,
            rawPayload: test.payload
        };

        const res = await fetch(FUNC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            // Wait for propagation
            await new Promise(r => setTimeout(r, 2000));
            const newPrice = await checkBooking();
            console.log(`Resulting Total Price: ${newPrice}`);

            if (newPrice === TARGET_PRICE) {
                console.log(`✅ SUCCESS! Payload '${test.name}' updated the TOTAL PRICE.`);
                // Keep going? No, stop.
                break;
            }
        } else {
            console.log(`Request failed: ${res.status}`);
        }
    }
}

run();
