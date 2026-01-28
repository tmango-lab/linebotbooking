import fetch from 'node-fetch';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEwMTQ5LCJpYXQiOjE3NjU1MDkzODUsInN1YiI6IkFyZW5hIn0.M5BYZqg9ExMe1BYtFJNlghoyWObQRdk6zCCzRwQmBAU';
const BASE_URL = 'https://arena.matchday-backend.com';

async function checkNullFields() {
    // Get bookings from Matchday for Jan-Dec 2026
    const res = await fetch(`${BASE_URL}/arena/matches`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify({
            time_start: '2026-01-01 00:00:00',
            time_end: '2027-01-01 00:00:00'
        })
    });

    const matches = await res.json();

    // Find unique court IDs
    const courtIds = new Set();
    matches.forEach(m => courtIds.add(m.court_id));

    console.log('All Court IDs found in Matchday:');
    console.log(Array.from(courtIds).sort((a, b) => a - b));

    // Check which ones are NOT in our mapping
    const mapped = [2424, 2425, 2428, 2426, 2427, 2429];
    const unmapped = Array.from(courtIds).filter(id => !mapped.includes(id));

    console.log('\n⚠️  Unmapped Court IDs:');
    console.log(unmapped);

    // Show sample bookings for unmapped courts
    if (unmapped.length > 0) {
        console.log('\nSample bookings for unmapped courts:');
        unmapped.forEach(courtId => {
            const sample = matches.find(m => m.court_id === courtId);
            if (sample) {
                console.log(`\nCourt ${courtId}:`);
                console.log(`  Booking ID: ${sample.id}`);
                console.log(`  Time: ${sample.time_start}`);
                console.log(`  Name: ${sample.name || sample.description}`);
            }
        });
    }
}

checkNullFields();
