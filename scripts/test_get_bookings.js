import fetch from 'node-fetch';

const SUPABASE_URL = 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

async function testGetBookings() {
    console.log('=== Testing get-bookings (Local DB) ===\n');

    // Test with a date that should have data
    const testDate = '2026-01-29';

    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ date: testDate })
    });

    if (!res.ok) {
        console.error(`❌ Error: ${res.status}`);
        console.error(await res.text());
        return;
    }

    const data = await res.json();
    console.log(`✅ Success! Retrieved ${data.bookings?.length || 0} bookings for ${testDate}\n`);

    // Show samples
    if (data.bookings && data.bookings.length > 0) {
        console.log('Sample bookings:');
        data.bookings.slice(0, 3).forEach((b, i) => {
            console.log(`\n[${i + 1}] ID: ${b.id}`);
            console.log(`    Court: ${b.court_id}`);
            console.log(`    Time: ${b.time_start} - ${b.time_end}`);
            console.log(`    Name: ${b.name}`);
            console.log(`    Price: ${b.price} THB`);
            console.log(`    Status: ${b.cancel ? 'CANCELLED' : 'CONFIRMED'}`);
        });
    }
}

testGetBookings();
