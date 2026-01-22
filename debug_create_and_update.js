
// debug_create_and_update.js

// This script simulates the backend logic we just implemented.
// We cannot easily import the TS file in Node without compilation,
// so we will replicate the NEW create logic here to verify it works against the real API.

const MD_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEwMTQ5LCJpYXQiOjE3NjU1MDkzODUsInN1YiI6IkFyZW5hIn0.M5BYZqg9ExMe1BYtFJNlghoyWObQRdk6zCCzRwQmBAU';
const MD_BASE_URL = 'https://arena.matchday-backend.com';

// --- Replicated Helper Functions ---

async function updateMatchdayBooking(matchId, payload) {
    if (!MD_TOKEN) throw new Error('MATCHDAY_TOKEN is missing');
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
        const txt = await res.text();
        throw new Error(`Update failed: ${txt}`);
    }
    const data = await res.json();
    return data;
}

async function createMatchdayBooking(params) {
    if (!MD_TOKEN) throw new Error('MATCHDAY_TOKEN is missing');
    const url = `${MD_BASE_URL}/arena/create-match`;

    const body = {
        courts: [params.courtId.toString()],
        time_start: params.timeStart,
        time_end: params.timeEnd,
        settings: {
            name: params.customerName,
            phone_number: params.phoneNumber,
            note: params.note || ''
        },
        payment: 'cash',
        method: 'fast-create',
        payment_multi: false,
        fixed_price: params.price || null,
        member_id: null,
        user_id: null
    };

    console.log('[MATCHDAY CREATE] Payload:', JSON.stringify(body));

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MD_TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Create failed: ${txt}`);
    }

    const data = await res.json();
    console.log('[MATCHDAY CREATE] Full Response:', JSON.stringify(data, null, 2)); // DEBUG: Log full response
    // console.log('[MATCHDAY CREATE] Success:', data.match ? `ID ${data.match.id}` : 'No match ID');

    // --- THE NEW LOGIC WE ADDED ---
    // Handle both single match object and matches array
    const createdMatch = data.match || (data.matches && data.matches[0]);

    if (params.price && createdMatch && createdMatch.id) {
        console.log(`[MATCHDAY API] Auto-correcting price for match ${createdMatch.id} to ${params.price}`);
        try {
            const updateRes = await updateMatchdayBooking(createdMatch.id, {
                time_start: params.timeStart,
                time_end: params.timeEnd,
                description: params.customerName,
                change_price: params.price
            });
            console.log(`[MATCHDAY API] Price auto-correction successful. New Price in System: ${updateRes.match.price}`);
            return { ...data, updatedMatch: updateRes.match };
        } catch (err) {
            console.error(`[MATCHDAY API] Failed to auto-correct price for match ${createdMatch.id}:`, err);
        }
    }
    // ------------------------------

    return data;
}

// --- Test Execution ---

async function runTest() {
    console.log("Starting Create+Update Test...");

    // Test Params: Create a 1-hour booking
    // Note: Use a time slot that is likely free. 
    // Field 1 (2424) at 21:00-22:00 Today (2026-01-22)
    const testParams = {
        courtId: 2424, // Field 1
        timeStart: "2026-01-22 22:00:00",
        timeEnd: "2026-01-22 23:00:00", // 1 Hour
        customerName: "Test AutoPrice",
        phoneNumber: "0999999999",
        price: 900 // Normal might be 700 or 550. 900 proves our override works.
    };

    try {
        const result = await createMatchdayBooking(testParams);
        console.log("Final Booking Result:", result.updatedMatch ? "Includes Update" : "No Update");

        if (result.updatedMatch && result.updatedMatch.price === 900) {
            console.log("SUCCESS: Price was correctly forced to 900.");
        } else {
            console.log("FAILURE: Price is " + (result.updatedMatch ? result.updatedMatch.price : "Unknown"));
        }

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

runTest();
