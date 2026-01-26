
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env
const envPath = path.resolve(__dirname, '../.env');
const env = dotenv.parse(fs.readFileSync(envPath));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const MATCHDAY_TOKEN = process.env.MATCHDAY_TOKEN || env.MATCHDAY_TOKEN; // Actually, client uses Anon key to call functions

if (!SUPABASE_URL) {
    console.error('Missing VITE_SUPABASE_URL');
    process.exit(1);
}

const TEST_DATE = new Date().toISOString().split('T')[0]; // Today

async function main() {
    console.log(`[TEST] Target URL: ${SUPABASE_URL}`);
    console.log(`[TEST] Date: ${TEST_DATE}`);

    // 1. Get Bookings
    console.log('\n--- 1. Fetching Bookings ---');
    const getRes = await fetch(`${SUPABASE_URL}/functions/v1/get-bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ date: TEST_DATE })
    });

    if (!getRes.ok) throw new Error(await getRes.text());
    const getData = await getRes.json();
    const bookings = getData.bookings || [];
    console.log(`Found ${bookings.length} bookings.`);

    if (bookings.length === 0) {
        console.warn('No bookings found to test. Please create one manually first.');
        return;
    }

    const targetBooking = bookings[0];
    const matchId = targetBooking.id;
    console.log(`Target Booking: ${matchId} | Name: ${targetBooking.name} | Price: ${targetBooking.price}`);

    // 2. Update Booking
    const NEW_PRICE = 555;
    const NEW_NOTE = `TestNote_${Date.now()}`;

    console.log(`\n--- 2. Updating Booking ${matchId} ---`);
    console.log(`Setting Price: ${NEW_PRICE}, Note: ${NEW_NOTE}`);

    const updateRes = await fetch(`${SUPABASE_URL}/functions/v1/update-booking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            matchId: matchId,
            price: NEW_PRICE,
            adminNote: NEW_NOTE,
            // Passthrough for Matchday safety
            timeStart: targetBooking.time_start,
            timeEnd: targetBooking.time_end,
            customerName: targetBooking.name,
            tel: targetBooking.tel
        })
    });

    if (!updateRes.ok) throw new Error(await updateRes.text());
    const updateData = await updateRes.json();
    console.log('Update Result:', updateData);

    // 3. Verify Update
    console.log(`\n--- 3. Verifying Update ---`);
    const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/get-bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ date: TEST_DATE })
    });

    const verifyData = await verifyRes.json();
    const verifyBookings = verifyData.bookings || [];
    const verifiedBooking = verifyBookings.find(b => b.id === matchId);

    if (verifiedBooking) {
        console.log(`Verified Booking: ${verifiedBooking.id}`);
        console.log(`Price: ${verifiedBooking.price} (Expected: ${NEW_PRICE})`);
        console.log(`Note: ${verifiedBooking.admin_note} (Expected: ${NEW_NOTE})`);

        let success = true;
        if (verifiedBooking.price !== NEW_PRICE) {
            console.error('❌ Price mismatch!');
            success = false;
        }
        if (verifiedBooking.admin_note !== NEW_NOTE) {
            console.error('❌ Note mismatch!');
            success = false;
        }

        if (success) console.log('\n✅ TEST PASSED');
        else console.log('\n❌ TEST FAILED');

    } else {
        console.error('❌ Booking not found in verification fetch!');
    }
}

main().catch(console.error);
