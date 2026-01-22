
// local_server.js
// A local replacement for the create-booking Edge Function.
// Usage: node local_server.js

import { createServer } from 'http';

const PORT = 3000;
const MD_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEwMTQ5LCJpYXQiOjE3NjU1MDkzODUsInN1YiI6IkFyZW5hIn0.M5BYZqg9ExMe1BYtFJNlghoyWObQRdk6zCCzRwQmBAU';
const MD_BASE_URL = 'https://arena.matchday-backend.com';

const FIELD_MAP = {
    2424: 2424, // Field 1
    2425: 2425, // Field 2
    2428: 2428, // Field 3
    2426: 2426, // Field 4
    2427: 2427, // Field 5
    2429: 2429, // Field 6
};

const PRICING = {
    2424: { pre: 500, post: 700 },
    2425: { pre: 500, post: 700 },
    2428: { pre: 1000, post: 1200 },
    2426: { pre: 800, post: 1000 },
    2427: { pre: 800, post: 1000 },
    2429: { pre: 1000, post: 1200 },
};

function calculatePrice(fieldId, startTime, durationHours) {
    const prices = PRICING[fieldId];
    if (!prices) return 0;

    const [h, m] = startTime.split(':').map(Number);
    const startH = h + (m / 60);
    const endH = startH + durationHours;
    const cutOff = 18.0;

    let preHours = 0;
    let postHours = 0;

    if (endH <= cutOff) preHours = durationHours;
    else if (startH >= cutOff) postHours = durationHours;
    else {
        preHours = cutOff - startH;
        postHours = endH - cutOff;
    }

    let prePrice = preHours * prices.pre;
    let postPrice = postHours * prices.post;

    // --- FIX: Round Up Pre-Prices too ---
    if (prePrice > 0 && prePrice % 100 !== 0) {
        prePrice = Math.ceil(prePrice / 100) * 100;
    }
    if (postPrice > 0 && postPrice % 100 !== 0) {
        postPrice = Math.ceil(postPrice / 100) * 100;
    }

    return Math.round(prePrice + postPrice);
}

// Helper: Fetch wrapper for Node 18+
async function updateMatch(matchId, payload) {
    console.log(`[Auto-Correct] Updating match ${matchId} to price ${payload.change_price}`);
    const res = await fetch(`${MD_BASE_URL}/arena/match/${matchId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MD_TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) console.error('Update Failed:', await res.text());
}

const server = createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/functions/v1/create-booking' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const params = JSON.parse(body);
                console.log('[Received Booking]', params);

                const { fieldId, date, startTime, endTime, customerName, phoneNumber, note } = params;

                // Calc Duration
                const [sh, sm] = startTime.split(':').map(Number);
                const [eh, em] = endTime.split(':').map(Number);
                const durationH = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

                // 1. Calculate Correct Price
                const price = calculatePrice(fieldId, startTime, durationH);
                console.log('[Calculated Price]', price); // Should be 800

                // 2. Create on Matchday
                const createPayload = {
                    courts: [FIELD_MAP[fieldId].toString()],
                    time_start: `${date} ${startTime}:00`,
                    time_end: `${date} ${endTime}:00`,
                    settings: { name: customerName, phone_number: phoneNumber, note: note || '' },
                    payment: 'cash',
                    method: 'fast-create',
                    payment_multi: false,
                    fixed_price: price
                };

                const mdRes = await fetch(`${MD_BASE_URL}/arena/create-match`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${MD_TOKEN}`,
                        'Origin': 'https://arena.matchday.co.th'
                    },
                    body: JSON.stringify(createPayload)
                });

                const mdText = await mdRes.text();
                let mdData = {};
                try { mdData = JSON.parse(mdText); } catch (e) { }

                console.log('[Matchday Response]', mdData);

                // 3. Auto-Correct Logic
                const createdMatch = mdData.match || (mdData.matches && mdData.matches[0]);
                if (createdMatch && createdMatch.id) {
                    // Always enforce the calculated price
                    await updateMatch(createdMatch.id, {
                        time_start: `${date} ${startTime}:00`,
                        time_end: `${date} ${endTime}:00`,
                        description: customerName,
                        change_price: price
                    });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: mdData, price }));

            } catch (err) {
                console.error(err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Local Booking Server running on http://localhost:${PORT}`);
    console.log(`Please update .env to: VITE_SUPABASE_URL=http://localhost:${PORT}`);
});
