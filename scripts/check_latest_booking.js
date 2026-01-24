
// Check bookings for 2026-04-03
// Usage: node scripts/check_latest_booking.js

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z645jX1EhAnuMd_B58MZ8A_9f81mnSV';

async function run() {
    console.log('--- Fetching Bookings for 2026-04-03 ---');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-bookings`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: '2026-04-03' })
    });

    if (!res.ok) {
        console.error('Failed:', await res.text());
        return;
    }

    const data = await res.json();
    const bookings = data.bookings || [];

    console.log(`Found ${bookings.length} bookings.`);

    // Find the latest one created (assuming high ID = newer)
    const latest = bookings.sort((a, b) => b.id - a.id)[0];

    if (latest) {
        console.log(`Latest Booking ID: ${latest.id}`);
        console.log(`Name: ${latest.name}`);
        console.log(`Total Price: ${latest.total_price}`);
        console.log(`Match Price: ${latest.match_price}`);
        console.log(`Payment Detail:`, JSON.stringify(latest.payment_detail, null, 2));

        if (latest.total_price === 700) {
            console.log('✅ VERIFIED: Total Price is 700');
        } else {
            console.log(`❌ FAILURE: Total Price is ${latest.total_price} (Expected 700)`);
        }
    } else {
        console.log('No bookings found for this date.');
    }
}

run();
