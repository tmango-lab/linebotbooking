import fetch from 'node-fetch';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEwMTQ5LCJpYXQiOjE3NjU1MDkzODUsInN1YiI6IkFyZW5hIn0.M5BYZqg9ExMe1BYtFJNlghoyWObQRdk6zCCzRwQmBAU';
const BASE_URL = 'https://arena.matchday-backend.com';
const START_DATE = '2026-02-05'; // Specific day user asked for
const END_DATE = '2026-02-06';   // Next day to cover full 24h of Feb 5
const TARGET_COURT = 2426;

async function runDebug() {
    console.log(`Checking Court ${TARGET_COURT} for ${START_DATE} to ${END_DATE}...`);

    const res = await fetch(`${BASE_URL}/arena/matches`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify({
            time_start: `${START_DATE} 00:00:00`,
            time_end: `${END_DATE} 00:00:00`
        })
    });

    const matches = await res.json();
    const targetMatches = matches.filter(m => m.court_id === TARGET_COURT);

    console.log(`\nFound ${targetMatches.length} matches for Court ${TARGET_COURT}:`);

    targetMatches.forEach((m, i) => {
        console.log(`\n[#${i + 1}] ID: ${m.id}`);
        console.log(`Time: ${m.time_start} - ${m.time_end}`);
        console.log(`Name: ${m.name || m.description}`);
        console.log(`Status: ${m.cancel ? 'CANCELLED ❌' : 'CONFIRMED ✅'}`);
    });
}

runDebug();
