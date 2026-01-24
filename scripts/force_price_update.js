
// Force Price Update with Multiple Fields
// Usage: node scripts/force_price_update.js

const FUNC_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/debug-price-update';
const TOKEN = 'sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV';

const MATCH_ID = 1460253; // The failed booking
const PRICE = 700;

async function run() {
    console.log(`--- Forcing Price Update to ${PRICE} for Match ${MATCH_ID} ---`);
    console.log('Sending "all" strategy...');

    const res = await fetch(FUNC_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            matchId: MATCH_ID,
            price: PRICE,
            fieldToTest: 'all' // The debug function supports 'all' -> sends fixed_price + change_price
        })
    });

    const text = await res.text();
    console.log('Result:', text);
}

run();
