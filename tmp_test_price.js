
const FUNC_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/debug-price-update';
const TOKEN = 'sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV'; // Using anon key, function handles auth internally via Deno.env

async function test(field) {
    console.log(`Testing field: ${field}`);
    const res = await fetch(FUNC_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            matchId: 1460253,
            price: 700,
            fieldToTest: 'change_price'
        })
    });
    const text = await res.text();
    console.log('Result:', text);
}

// We suspect 'fixed_price' is key, but let's try 'all' first or strictly 'fixed_price' as per my change?
// Let's test 'change_price' (what failed), 'fixed_price' (my fix attempt), and 'price' (standard).

async function run() {
    // 1. Try 'fixed_price' first as that's what I just deployed and suspect is correct
    await test('fixed_price');
}

run();
