
// debug_edit_api_node.js

// Token captured from previous browser sessions
const MD_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEwMTQ5LCJpYXQiOjE3NjU1MDkzODUsInN1YiI6IkFyZW5hIn0.M5BYZqg9ExMe1BYtFJNlghoyWObQRdk6zCCzRwQmBAU';
const MD_BASE_URL = 'https://arena.matchday-backend.com';
const MATCH_ID = 1455983;

async function updateMatchdayBooking(matchId, payload) {
    if (!MD_TOKEN) {
        throw new Error('MATCHDAY_TOKEN is missing');
    }

    const url = `${MD_BASE_URL}/arena/match/${matchId}`;

    console.log(`[MATCHDAY UPDATE] Updating match ${matchId} with payload:`, JSON.stringify(payload));

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MD_TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Matchday Update Error: ${res.status} - ${errorText}`);
        throw new Error(`Failed to update booking ${matchId} on Matchday: ${errorText}`);
    }

    const data = await res.json();
    console.log('[MATCHDAY UPDATE] Success:', data);
    return data;
}

async function testUpdate() {
    console.log("Starting Update Test (Node.js)...");

    try {
        const payload = {
            description: "ทดสอบ",
            time_start: "2026-01-22 08:01",
            time_end: "2026-01-22 09:00",
            remark: null,
            change_price: 700 // Setting to 700 as requested by user verification
        };

        const result = await updateMatchdayBooking(MATCH_ID, payload);
        console.log("Update Result:", result);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testUpdate();
